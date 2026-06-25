import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const COMBO_LIMIT_MS = 500;

const ZONES = {
  head: {
    name: "머리",
    min: 8,
    max: 16,
    reaction: "hit-head",
    hitbox: "head-zone",
    wound: { type: "bandage", emoji: "🩹", x: 47, y: 26 },
  },
  face: {
    name: "얼굴",
    min: 11,
    max: 24,
    reaction: "hit-face",
    hitbox: "face-zone",
    wound: { type: "nosebleed", emoji: "🩸", x: 51, y: 34 },
  },
  philtrum: {
    name: "인중",
    min: 15,
    max: 30,
    reaction: "hit-face",
    hitbox: "philtrum-zone",
    weak: true,
    wound: { type: "nosebleed", emoji: "🩸", x: 50, y: 35 },
  },
  chest: {
    name: "명치",
    min: 16,
    max: 32,
    reaction: "hit-body",
    hitbox: "chest-zone",
    weak: true,
    wound: { type: "bruise", emoji: "🟣", x: 51, y: 50 },
  },
  belly: {
    name: "배",
    min: 9,
    max: 19,
    reaction: "hit-body",
    hitbox: "belly-zone",
    wound: { type: "bruise", emoji: "🟣", x: 50, y: 58 },
  },
  groin: {
    name: "급소",
    min: 14,
    max: 28,
    reaction: "hit-groin",
    hitbox: "groin-zone",
    weak: true,
    wound: { type: "dizzy", emoji: "💫", x: 52, y: 67 },
  },
  leg: {
    name: "다리",
    min: 6,
    max: 14,
    reaction: "hit-leg",
    hitbox: "leg-zone",
    wound: { type: "bandage", emoji: "🩹", x: 55, y: 79 },
  },
};

function App() {
  const pressStart = useRef(0);
  const effectId = useRef(1);
  const woundId = useRef(1);
  const lastHitAt = useRef(0);
  const comboResetTimer = useRef(null);

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
  const [floatingEffects, setFloatingEffects] = useState([]);
  const [wounds, setWounds] = useState([]);

  function startGame() {
    const cleanName = nickname.trim();
    if (!cleanName) {
      alert("닉네임을 입력해줘!");
      return;
    }

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
    setChargePercent(0);
    setFloatingEffects([]);
    setWounds([]);
    lastHitAt.current = 0;

    if (comboResetTimer.current) {
      clearTimeout(comboResetTimer.current);
      comboResetTimer.current = null;
    }
  }

  function startCharge(event) {
    event.preventDefault();
    pressStart.current = Date.now();
    setChargePercent(100);
  }

  function endCharge(zoneKey, event) {
    event.preventDefault();

    const zone = ZONES[zoneKey];
    if (!zone) return;

    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    const touchX = event.clientX - rect.left;
    const touchY = event.clientY - rect.top;

    const now = Date.now();
    const isComboContinuing = now - lastHitAt.current <= COMBO_LIMIT_MS;
    const nextCombo = isComboContinuing ? stats.combo + 1 : 1;
    lastHitAt.current = now;

    if (comboResetTimer.current) clearTimeout(comboResetTimer.current);

    comboResetTimer.current = setTimeout(() => {
      setStats((prev) => {
        const next = { ...prev, combo: 0 };
        localStorage.setItem("punch_stats", JSON.stringify(next));
        return next;
      });
    }, COMBO_LIMIT_MS);

    const holdTime = Math.min(now - pressStart.current, 2200);
    const chargeMultiplier = 1 + holdTime / 850;

    const baseDamage = random(zone.min, zone.max);
    const weakBonus = zone.weak ? 0.16 : 0;
    const comboBonus = Math.min(nextCombo * 0.02, 0.2);
    const isCritical = Math.random() < 0.12 + weakBonus + comboBonus;
    const isUltra = holdTime > 1300 && Math.random() < 0.22 + weakBonus;

    let damage = Math.floor(baseDamage * chargeMultiplier);

    if (isCritical) damage *= 3;
    if (isUltra) damage *= 5;

    const nextStats = {
      hits: stats.hits + 1,
      totalDamage: stats.totalDamage + damage,
      maxDamage: Math.max(stats.maxDamage, damage),
      combo: nextCombo,
    };

    setStats(nextStats);
    localStorage.setItem("punch_stats", JSON.stringify(nextStats));

    const nextReaction = isUltra
      ? "super-critical"
      : isCritical
      ? "critical"
      : zone.reaction;

    setReaction(nextReaction);
    setChargePercent(0);

    addFloatingEffect({
      x: touchX,
      y: touchY,
      damage,
      critical: isCritical,
      ultra: isUltra,
      combo: nextCombo,
    });

    addWound(zone, damage, isCritical, isUltra);
    vibrate(isUltra, isCritical);

    const message = isUltra
      ? `🔥 ${zone.name} 울트라 크리티컬! ${damage} 데미지`
      : isCritical
      ? `💥 ${zone.name} 크리티컬! ${damage} 데미지`
      : `👊 ${zone.name} 타격! ${damage} 데미지`;

    setLog((prev) => [message, ...prev].slice(0, 7));

    setTimeout(() => {
      setReaction("");
    }, isUltra ? 700 : 460);
  }

  function addFloatingEffect({ x, y, damage, critical, ultra, combo }) {
    const id = effectId.current++;

    setFloatingEffects((prev) => [
      ...prev,
      {
        id,
        x,
        y,
        damage,
        critical,
        ultra,
        combo,
        label: ultra ? "ULTRA!" : critical ? "CRITICAL!" : "HIT!",
        emoji: ultra ? "💥" : critical ? "💢" : "👊",
      },
    ]);

    setTimeout(() => {
      setFloatingEffects((prev) => prev.filter((item) => item.id !== id));
    }, 850);
  }

  function addWound(zone, damage, isCritical, isUltra) {
    if (!zone.wound) return;

    const shouldAdd =
      isUltra || isCritical || damage >= 30 || Math.random() < 0.12;

    if (!shouldAdd) return;

    const id = woundId.current++;
    const spreadX = random(-2, 2);
    const spreadY = random(-2, 2);

    setWounds((prev) => {
      const withoutSameTypeNearBy = prev.filter((item) => {
        const sameType = item.type === zone.wound.type;
        const nearX = Math.abs(item.x - zone.wound.x) <= 5;
        const nearY = Math.abs(item.y - zone.wound.y) <= 5;
        return !(sameType && nearX && nearY);
      });

      const next = [
        ...withoutSameTypeNearBy,
        {
          id,
          type: zone.wound.type,
          emoji: zone.wound.emoji,
          x: zone.wound.x + spreadX,
          y: zone.wound.y + spreadY,
          big: isUltra || damage >= 55,
        },
      ];

      return next.slice(-5);
    });
  }

  function vibrate(isUltra, isCritical) {
    if (!navigator.vibrate) return;

    if (isUltra) {
      navigator.vibrate([40, 40, 80]);
      return;
    }

    if (isCritical) {
      navigator.vibrate([30, 30, 40]);
      return;
    }

    navigator.vibrate(18);
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
    <div
      className="app"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onSelect={(e) => e.preventDefault()}
    >
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

      <main
        className={`stage ${reaction.includes("critical") ? "shake" : ""}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="target-wrap">
          <img
            className={`character ${reaction}`}
            src="/coach_red.png"
            alt="character"
            draggable="false"
          />

          {wounds.map((wound) => (
            <div
              key={wound.id}
              className={`wound ${wound.type} ${wound.big ? "big-wound" : ""}`}
              style={{ left: `${wound.x}%`, top: `${wound.y}%` }}
            >
              {wound.emoji}
            </div>
          ))}
        </div>

        {floatingEffects.map((item) => (
          <div
            key={item.id}
            className={`floating-effect ${
              item.ultra ? "ultra-effect" : item.critical ? "critical-effect" : ""
            }`}
            style={{ left: item.x, top: item.y }}
          >
            <div className="hit-emoji">{item.emoji}</div>
            <div className="hit-label">{item.label}</div>
            <div className="hit-damage">-{item.damage}</div>
            {item.combo >= 2 && <div className="hit-combo">{item.combo} COMBO</div>}
          </div>
        ))}

        {Object.entries(ZONES).map(([key, zone]) => (
          <button
            key={key}
            aria-label={`${zone.name} hit zone`}
            className={`hit-zone ${zone.hitbox}`}
            onPointerDown={startCharge}
            onPointerUp={(event) => endCharge(key, event)}
            onPointerCancel={() => setChargePercent(0)}
          />
        ))}
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
