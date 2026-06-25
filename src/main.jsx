import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  const pressStart = useRef(0);
  const [nickname, setNickname] = useState(localStorage.getItem("nickname") || "");
  const [started, setStarted] = useState(!!localStorage.getItem("nickname"));
  const [stats, setStats] = useState(() => {
    return JSON.parse(localStorage.getItem("stats") || '{"hits":0,"damage":0,"max":0}');
  });
  const [log, setLog] = useState([]);
  const [reaction, setReaction] = useState("");
  const [charge, setCharge] = useState(0);

  const zones = {
    head: { name: "머리", min: 8, max: 16 },
    face: { name: "얼굴", min: 10, max: 20 },
    body: { name: "몸통", min: 7, max: 15 },
    leg: { name: "다리", min: 5, max: 12 }
  };

  function savePlayer() {
    if (!nickname.trim()) return alert("닉네임을 입력해줘!");
    localStorage.setItem("nickname", nickname.trim());
    setStarted(true);
  }

  function startCharge() {
    pressStart.current = Date.now();
    setCharge(20);
  }

  function endCharge(zoneKey) {
    const zone = zones[zoneKey];
    const hold = Math.min(Date.now() - pressStart.current, 1800);
    const multiplier = 1 + hold / 900;
    const base = rand(zone.min, zone.max);
    const critical = Math.random() < 0.12;
    const damage = Math.floor(base * multiplier * (critical ? 3 : 1));

    const newStats = {
      hits: stats.hits + 1,
      damage: stats.damage + damage,
      max: Math.max(stats.max, damage)
    };

    setStats(newStats);
    localStorage.setItem("stats", JSON.stringify(newStats));

    const message = critical
      ? `💥 ${zone.name} 크리티컬! ${damage} 데미지`
      : `👊 ${zone.name} 가격! ${damage} 데미지`;

    setLog((prev) => [message, ...prev].slice(0, 6));
    setReaction(critical ? "critical" : zoneKey);
    setCharge(0);

    setTimeout(() => setReaction(""), 350);
  }

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  if (!started) {
    return (
      <div className="app">
        <h1>혼쭐내기 👊</h1>
        <p>스트레스 타파 미니게임</p>
        <input
          placeholder="닉네임 입력"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <button onClick={savePlayer}>저장하고 시작</button>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>혼쭐내기 👊</h1>
        <p>{nickname}</p>
      </header>

      <section className="stats">
        <div>타격<br /><b>{stats.hits}</b></div>
        <div>총 데미지<br /><b>{stats.damage}</b></div>
        <div>최고 한방<br /><b>{stats.max}</b></div>
      </section>

      <main className="stage">
        <img
          className={`character ${reaction}`}
          src="/coach_red.png"
          alt="character"
        />

        <button className="zone head" onPointerDown={startCharge} onPointerUp={() => endCharge("head")} />
        <button className="zone face" onPointerDown={startCharge} onPointerUp={() => endCharge("face")} />
        <button className="zone body" onPointerDown={startCharge} onPointerUp={() => endCharge("body")} />
        <button className="zone leg" onPointerDown={startCharge} onPointerUp={() => endCharge("leg")} />

        {reaction === "critical" && <div className="boom">CRITICAL!</div>}
      </main>

      <div className="charge">
        <div style={{ width: `${charge}%` }} />
      </div>

      <section className="log">
        <b>타격 로그</b>
        {log.map((item, i) => <p key={i}>{item}</p>)}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
