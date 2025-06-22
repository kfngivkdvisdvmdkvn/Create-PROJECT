import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "https://create-project-1.onrender.com";
const POLL_INTERVAL = 30000;

function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const submit = async e => {
    e.preventDefault();
    try {
      let res = await axios.post(`${API_URL}/login`, { password });
      if (res.data.ok) onLogin(res.data.token);
      else setErr("รหัสผิด");
    } catch {
      setErr("รหัสผิด");
    }
  };
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 items-center justify-center">
      <form className="bg-white rounded-2xl shadow-2xl p-8 w-80 space-y-4" onSubmit={submit}>
        <h1 className="text-2xl font-bold mb-2">เข้าสู่ระบบ</h1>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="รหัสผ่าน"
          className="w-full px-3 py-2 border rounded-lg focus:outline-none"
          autoFocus
        />
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <button type="submit" className="w-full bg-black text-white rounded-lg py-2 font-semibold hover:bg-gray-700">เข้าสู่ระบบ</button>
      </form>
    </div>
  );
}

function SSIDSelect({ ssids, selected, onChange }) {
  return (
    <div className="mb-4">
      <label className="font-semibold">เลือก WiFi/SSID: </label>
      <select
        value={selected}
        onChange={e => onChange(e.target.value)}
        className="border rounded-lg px-2 py-1 ml-2"
      >
        <option value="">-- ทั้งหมด --</option>
        {ssids.map(ssid => (
          <option key={ssid} value={ssid}>{ssid}</option>
        ))}
      </select>
    </div>
  );
}

function AgentTable({ agents, onSelect, selected, onAction }) {
  return (
    <div className="overflow-x-auto bg-white shadow-xl rounded-2xl">
      <table className="min-w-full text-sm text-gray-900">
        <thead>
          <tr className="bg-gray-100">
            <th>
              <input
                type="checkbox"
                checked={selected.length === agents.length && agents.length > 0}
                onChange={e => onSelect(e.target.checked ? agents.map(a => a.agent_id) : [])}
              />
            </th>
            <th>Host</th>
            <th>SSID</th>
            <th>Battery</th>
            <th>ชาร์จ</th>
            <th>IP</th>
            <th>OS</th>
            <th>สถานะ</th>
            <th>คำสั่ง</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(a => (
            <tr key={a.agent_id} className="border-b">
              <td>
                <input
                  type="checkbox"
                  checked={selected.includes(a.agent_id)}
                  onChange={e =>
                    onSelect(
                      e.target.checked
                        ? [...selected, a.agent_id]
                        : selected.filter(id => id !== a.agent_id)
                    )
                  }
                />
              </td>
              <td>{a.hostname}</td>
              <td>{a.ssid}</td>
              <td>{a.battery && a.battery.percent !== null ? `${a.battery.percent}%` : "-"}</td>
              <td>{a.battery && a.battery.plugged ? "🔌" : "🔋"}</td>
              <td>{a.ip}</td>
              <td>{a.platform}</td>
              <td>{a.lastSeen ? (Math.floor((Date.now()-a.lastSeen)/1000) < 60 ? "ออนไลน์" : "ไม่ตอบสนอง") : "-"}</td>
              <td>
                <div className="flex flex-row gap-1">
                  <button className="bg-red-600 text-white px-2 rounded-lg" onClick={() => onAction("shutdown", [a.agent_id])}>ปิด</button>
                  <button className="bg-yellow-600 text-white px-2 rounded-lg" onClick={() => onAction("reboot", [a.agent_id])}>รีบูต</button>
                  <button className="bg-blue-600 text-white px-2 rounded-lg" onClick={() => onAction("block", [a.agent_id])}>บล็อค</button>
                  <button className="bg-gray-400 text-white px-2 rounded-lg" onClick={() => onAction("unblock", [a.agent_id])}>ปลด</button>
                  <button className="bg-purple-700 text-white px-2 rounded-lg" onClick={() => onAction("powershell", [a.agent_id])}>PS</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {agents.length === 0 && <div className="p-4 text-gray-400 text-center">ไม่มี agent ในกลุ่มนี้</div>}
    </div>
  );
}

function PowershellDialog({ open, onClose, onSubmit }) {
  const [cmd, setCmd] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 flex flex-col space-y-3">
        <h2 className="text-lg font-bold">Run PowerShell / Command</h2>
        <textarea className="border rounded-lg p-2 h-24" value={cmd} onChange={e=>setCmd(e.target.value)} placeholder="พิมพ์คำสั่ง"/>
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-1 rounded-lg bg-gray-400 text-white">ยกเลิก</button>
          <button onClick={() => { onSubmit(cmd); setCmd(""); }} className="px-4 py-1 rounded-lg bg-purple-700 text-white">Run</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardApp() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [ssids, setSSIDs] = useState([]);
  const [ssid, setSSID] = useState("");
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState([]);
  const [showPS, setShowPS] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      let sres = await axios.get(`${API_URL}/ssid`);
      setSSIDs(sres.data.ssids);
      let ares = await axios.get(`${API_URL}/agents${ssid ? `?ssid=${ssid}` : ""}`);
      setAgents(ares.data.agents);
    };
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [token, ssid]);

  if (!token) return <Login onLogin={tok => { setToken(tok); localStorage.setItem("token", tok); }} />;
  
  const handleAction = (cmd, agent_ids) => {
    if (cmd === "powershell") {
      setSelected(agent_ids);
      setShowPS(true);
      return;
    }
    axios.post(`${API_URL}/command`, { agent_ids, cmd });
  };

  const submitPowershell = script => {
    axios.post(`${API_URL}/command`, { agent_ids: selected, cmd: "powershell", script });
    setShowPS(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-blue-100 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-gray-900">NetSupport School Web Clone</h1>
        <SSIDSelect ssids={ssids} selected={ssid} onChange={setSSID} />
        <AgentTable agents={agents} selected={selected} onSelect={setSelected} onAction={handleAction} />
        <div className="flex flex-row gap-2 mt-4">
          <button className="bg-red-600 text-white rounded-lg px-4 py-2" onClick={() => handleAction("shutdown", selected)}>ปิดทุกเครื่องที่เลือก</button>
          <button className="bg-yellow-600 text-white rounded-lg px-4 py-2" onClick={() => handleAction("reboot", selected)}>รีบูตทุกเครื่องที่เลือก</button>
          <button className="bg-blue-600 text-white rounded-lg px-4 py-2" onClick={() => handleAction("block", selected)}>บล็อคหน้าจอ</button>
          <button className="bg-gray-400 text-white rounded-lg px-4 py-2" onClick={() => handleAction("unblock", selected)}>ปลดบล็อค</button>
          <button className="bg-purple-700 text-white rounded-lg px-4 py-2" onClick={() => handleAction("powershell", selected)}>รัน PowerShell/Command</button>
        </div>
      </div>
      <PowershellDialog open={showPS} onClose={() => setShowPS(false)} onSubmit={submitPowershell} />
    </div>
  );
}
