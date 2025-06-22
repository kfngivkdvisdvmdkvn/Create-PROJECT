import os
import sys
import time
import threading
import socket
import json
import subprocess
import platform
import psutil
import websocket  # pip install websocket-client
import uuid

SERVER_URL = "ws://<BACKEND_IP>:8000/agent"  # <--- ตั้งค่า backend IP ตรงนี้

def get_hostname():
    return socket.gethostname()

def get_ssid():
    if platform.system() == "Windows":
        try:
            output = subprocess.check_output('netsh wlan show interfaces', shell=True).decode(errors="ignore")
            for line in output.split("\n"):
                if "SSID" in line and "BSSID" not in line:
                    return line.split(":")[1].strip()
        except:
            return "Unknown"
    elif platform.system() == "Darwin":
        try:
            output = subprocess.check_output(['/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport', '-I']).decode()
            for line in output.split("\n"):
                if " SSID:" in line:
                    return line.split(":")[1].strip()
        except:
            return "Unknown"
    else:
        try:
            output = subprocess.check_output('iwgetid -r', shell=True).decode().strip()
            return output if output else "Unknown"
        except:
            return "Unknown"

def get_battery():
    try:
        battery = psutil.sensors_battery()
        return {
            "percent": battery.percent if battery else None,
            "plugged": battery.power_plugged if battery else None
        }
    except:
        return {"percent": None, "plugged": None}

def shutdown():
    if platform.system() == "Windows":
        os.system("shutdown /s /t 1")
    elif platform.system() in ["Linux", "Darwin"]:
        os.system("shutdown -h now")

def reboot():
    if platform.system() == "Windows":
        os.system("shutdown /r /t 1")
    elif platform.system() in ["Linux", "Darwin"]:
        os.system("reboot")

def run_powershell(cmd):
    if platform.system() == "Windows":
        try:
            output = subprocess.check_output(['powershell', '-Command', cmd], stderr=subprocess.STDOUT)
            return output.decode()
        except Exception as e:
            return str(e)
    else:
        try:
            output = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT)
            return output.decode()
        except Exception as e:
            return str(e)

overlay_active = False
overlay_thread = None

def block_screen():
    global overlay_active, overlay_thread
    overlay_active = True
    if platform.system() == "Windows":
        import tkinter as tk
        def show_overlay():
            root = tk.Tk()
            root.attributes('-fullscreen', True)
            root.configure(bg='black')
            root.attributes('-topmost', True)
            root.overrideredirect(True)
            root.after(100, lambda: root.focus_force())
            while overlay_active:
                root.update()
                time.sleep(0.05)
            root.destroy()
        overlay_thread = threading.Thread(target=show_overlay)
        overlay_thread.start()
    else:
        # TODO: Implement for Mac/Linux
        pass

def unblock_screen():
    global overlay_active
    overlay_active = False

class AgentClient:
    def __init__(self, server_url):
        self.server_url = server_url
        self.agent_id = str(uuid.uuid4())
        self.ws = None
        self.connected = False
        self.status_thread = None

    def send_status(self):
        data = {
            "agent_id": self.agent_id,
            "hostname": get_hostname(),
            "ssid": get_ssid(),
            "battery": get_battery(),
            "platform": platform.system(),
            "user": os.getlogin(),
            "ip": socket.gethostbyname(socket.gethostname())
        }
        try:
            self.ws.send(json.dumps({"type": "status", "data": data}))
        except Exception as e:
            print(f"Send status error: {e}")

    def on_message(self, ws, message):
        try:
            msg = json.loads(message)
            if msg.get("type") == "command":
                cmd = msg["data"]["cmd"]
                if cmd == "shutdown":
                    self.send_ack("shutdown", "OK")
                    shutdown()
                elif cmd == "reboot":
                    self.send_ack("reboot", "OK")
                    reboot()
                elif cmd == "block":
                    block_screen()
                    self.send_ack("block", "OK")
                elif cmd == "unblock":
                    unblock_screen()
                    self.send_ack("unblock", "OK")
                elif cmd == "powershell":
                    output = run_powershell(msg["data"]["script"])
                    self.send_ack("powershell", output)
        except Exception as e:
            print("Message handler error:", e)

    def send_ack(self, cmd, result):
        try:
            self.ws.send(json.dumps({
                "type": "ack",
                "data": {"cmd": cmd, "result": result, "agent_id": self.agent_id}
            }))
        except Exception as e:
            print(f"Send ack error: {e}")

    def on_open(self, ws):
        print("Connected to server.")
        self.connected = True
        def report_status():
            while self.connected:
                self.send_status()
                time.sleep(30)
        self.status_thread = threading.Thread(target=report_status, daemon=True)
        self.status_thread.start()

    def on_close(self, ws, *args):
        print("Connection closed.")
        self.connected = False

    def on_error(self, ws, error):
        print("WebSocket error:", error)
        self.connected = False

    def run(self):
        while True:
            try:
                self.ws = websocket.WebSocketApp(
                    self.server_url,
                    on_message=self.on_message,
                    on_open=self.on_open,
                    on_close=self.on_close,
                    on_error=self.on_error
                )
                self.ws.run_forever()
            except Exception as e:
                print("Reconnect in 5s...", e)
                time.sleep(5)

if __name__ == "__main__":
    agent = AgentClient(SERVER_URL)
    agent.run()