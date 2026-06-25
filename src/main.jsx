import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

function App() {
  const pressStart = useRef(0);

  const [nickname, setNickname] = useState(
    localStorage.getItem("punch_nickname") || ""
  );

  const [started, setStarted] = useState(
    !!localStorage.getItem("punch_nickname")
  );

  const [stats, setStats] = useState(() => {
    return JSON.parse(
      localStorage.getItem("punch_stats") ||
        '{"hits":0,"totalDamage":0,"maxDamage":0,"combo":0}'
    );
  });

  const [log, setLog] = useState([]);
  const [reaction, setReaction] = useState("");
  const [chargePercent, setChargePercent] = useState(0);
  const [effect, setEffect] = useState("");

  const zones = {
    head: { name: "머리", min: 8, max: 16, reaction: "hit-head" },
    face: { name: "얼굴", min: 10, max: 20, reaction: "hit-face" },
    body: { name: "몸통", min: 7, max: 15, reaction: "hit-body" },
    leg: { name: "다리", min: 5, max: 12, reaction: "hit-leg" },
  };

  function startGame() {
    const cleanName = nickname.trim();
    if (!cleanName) return alert("닉네임을 입력해줘!");

    localStorage.setItem("punch_nickname", cleanName);
    setNickname(cleanName);
    setStarted(true);
  }

  function resetGame() {
    const resetStats = {
      hits: 0,
      totalDamage: 0,
      maxDamage: 0,
      combo: 0,
    };

    localStorage.setItem("punch_stats", JSON.stringify(resetStats));
    setStats(resetStats);
    setLog([]);
    setReaction("");
    setEffect("");
    setChargePercent(0);
  }

  function startCharge() {
    pressStart.current = Date.now();
    setChargePercent(100);
  }

  function endCharge(zoneKey) {
    const zone = zones[zoneKey];
    if (!zone) return;

    const holdTime = Math.min(Date.now() - pressStart.current, 2000);
    const chargeMultiplier = 1 + holdTime / 900;

    const baseDamage = random(zone.min, zone.max);
    const isCritical = Math.random() < 0.12;
    const isUltra = holdTime > 1300 && Math.random() < 0.18;

    let damage = Math.floor(baseDamage * chargeMultiplier);

    if (isCritical) damage *= 3;
    if (isUltra) damage *= 5;

    const nextStats = {
      hits: stats.hits + 1,
      totalDamage: stats.totalDamage + damage,
      maxDamage: Math.max(stats.maxDamage, damage),
      combo: stats.combo + 1,
    };

    setStats(nextStats);
    localStorage.setItem("punch_stats", JSON.stringify(nextStats));

    const nextReaction = isUltra
      ? "super-critical"
      : isCritical
      ? "critical"
      : zone.reaction;

    setReaction(nextReaction);
    setEffect(isUltra ? "ULTRA!" : isCritical ? "CRITICAL!" : "HIT!");

    const message = isUltra
      ? `🔥 ${zone.name} 울트라 크리티컬! ${damage} 데미지`
      : isCritical
      ? `💥 ${zone.name} 크리티컬! ${damage} 데미지`
      : `👊 ${zone.name} 타격! ${damage} 데미지`;

    setLog((prev) => [message, ...prev].slice(0, 7));
    setChargePercent(0);

    setTimeout(() => {
      setReaction("");
      setEffect("");
    }, 420);
  }

  function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  if (!started) {
    return (
      <div className="app intro">
        <h1>혼쭐내기 👊</h1>
        <p>캐릭터를 터치해서 스트레스를 날려보자!</p>

        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 입력"
          maxLength={12}
        />

        <button className="primary-button" onClick={startGame}>
          게임 시작
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>혼쭐내기 👊</h1>
          <p>{nickname}</p>
        </div>

        <button className="small-button" onClick={resetGame}>
          리셋
        </button>
      </header>

      <section className="stats">
        <div>
          <span>타격</span>
          <b>{stats.hits}</b>
        </div>
        <div>
          <span>총 데미지</span>
          <b>{stats.totalDamage}</b>
        </div>
        <div>
          <span>최고 한방</span>
          <b>{stats.maxDamage}</b>
        </div>
        <div>
          <span>콤보</span>
          <b>{stats.combo}</b>
        </div>
      </section>

      <main className={`stage ${reaction.includes("critical") ? "shake" : ""}`}>
        <img
          className={`character ${reaction}`}
          src="/coach_red.png"
          alt="character"
        />

        {effect && <div className="effect-text">{effect}</div>}

        <button
          className="hit-zone head-zone"
          onPointerDown={startCharge}
          onPointerUp={() => endCharge("head")}
          onPointerCancel={() => setChargePercent(0)}
        />

        <button
          className="hit-zone face-zone"
          onPointerDown={startCharge}
          onPointerUp={() => endCharge("face")}
          onPointerCancel={() => setChargePercent(0)}
        />

        <button
          className="hit-zone body-zone"
          onPointerDown={startCharge}
          onPointerUp={() => endCharge("body")}
          onPointerCancel={() => setChargePercent(0)}
        />

        <button
          className="hit-zone leg-zone"
          onPointerDown={startCharge}
          onPointerUp={() => endCharge("leg")}
          onPointerCancel={() => setChargePercent(0)}
        />
      </main>

      <section className="charge-box">
        <div className="charge-label">꾹 눌러 차지 공격</div>
        <div className="charge-bar">
          <div style={{ width: `${chargePercent}%` }} />
        </div>
      </section>

      <section className="log">
        <b>타격 로그</b>
        {log.length === 0 && <p>캐릭터를 터치해봐!</p>}
        {log.map((item, index) => (
          <p key={`${item}-${index}`}>{item}</p>
        ))}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
