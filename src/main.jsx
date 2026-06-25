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
    weak: false,
    pose: "backHead",
    line: ["아!", "어우!", "머리 울려!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  face: {
    name: "얼굴",
    min: 11,
    max: 24,
    reaction: "hit-face",
    hitbox: "face-zone",
    weak: false,
    pose: "normal",
    line: ["으악!", "아야!", "얼굴은 반칙!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  philtrum: {
    name: "인중",
    min: 15,
    max: 30,
    reaction: "hit-face",
    hitbox: "philtrum-zone",
    weak: true,
    pose: "normal",
    line: ["끄억!", "인중은 안 돼!", "눈물 난다!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  chest: {
    name: "명치",
    min: 16,
    max: 32,
    reaction: "hit-body",
    hitbox: "chest-zone",
    weak: true,
    pose: "body",
    line: ["컥!", "숨 막혀!", "명치...!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  belly: {
    name: "배",
    min: 9,
    max: 19,
    reaction: "hit-body",
    hitbox: "belly-zone",
    weak: false,
    pose: "body",
    line: ["윽!", "배 아파!", "오우!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  groin: {
    name: "급소",
    min: 14,
    max: 28,
    reaction: "hit-groin",
    hitbox: "groin-zone",
    weak: true,
    pose: "body",
    line: ["으아아악!", "그건 아니지!", "잠깐만!!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  leg: {
    name: "다리",
    min: 6,
    max: 14,
    reaction: "hit-leg",
    hitbox: "leg-zone",
    weak: false,
    pose: "normal",
    line: ["휘청!", "다리 풀린다!", "아야!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
};

const CHARACTER_IMAGES = {
  normal: "/coach_red.png",
  backHead: "/coach_red2.png",
  body: "/coach_red3.png",
};

function App() {
  const pressStart = useRef(0);
  const effectId = useRef(1);
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
  const [impact, setImpact] = useState("");
  const [characterPose, setCharacterPose] = useState("normal");
  const [chargePercent, setChargePercent] = useState(0);
  const [floatingEffects, setFloatingEffects] = useState([]);
  const [speech, setSpeech] = useState("");
  const [flash, setFlash] = useState("");

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
    setImpact("");
    setCharacterPose("normal");
    setChargePercent(0);
    setFloatingEffects([]);
    setSpeech("");
    setFlash("");
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

    const nextImpact = isUltra
      ? "impact-ultra"
      : isCritical
      ? "impact-critical"
      : zone.pose === "body"
      ? "impact-body"
      : "impact-small";

    setReaction(nextReaction);
    setImpact(nextImpact);
    setCharacterPose(zone.pose || "normal");
    setChargePercent(0);

    addFloatingEffect({
      x: touchX,
      y: touchY,
      damage,
      critical: isCritical,
      ultra: isUltra,
      combo: nextCombo,
    });

    showSpeech(zone, isCritical, isUltra);
    showFlash(isCritical, isUltra);
    vibrate(isUltra, isCritical);

    const message = isUltra
      ? `🔥 ${zone.name} 울트라 응원! ${damage} 포인트`
      : isCritical
      ? `💥 ${zone.name} 크리티컬 응원! ${damage} 포인트`
      : `👊 ${zone.name} 응원! ${damage} 포인트`;

    setLog((prev) => [message, ...prev].slice(0, 7));

    setTimeout(() => {
      setReaction("");
      setImpact("");
      setCharacterPose("normal");
    }, isUltra ? 720 : 480);
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

  function showSpeech(zone, isCritical, isUltra) {
    const lines = isUltra
      ? ["으아아악!!", "잠깐만!!", "너무 강해!!", "내 안에 뭔가가 움직였다"]
      : isCritical
      ? ["악!!", "크윽!!", "제대로 들어왔다!", "나를 버렸습니다.", "이게 팀이야"]
      : zone.line;

    const nextLine = lines[random(0, lines.length - 1)];
    setSpeech(nextLine);

    setTimeout(() => {
      setSpeech("");
    }, 820);
  }

  function showFlash(isCritical, isUltra) {
    if (!isCritical && !isUltra) return;

    setFlash(isUltra ? "ultra-flash" : "critical-flash");

    setTimeout(() => {
      setFlash("");
    }, isUltra ? 130 : 90);
  }

  function vibrate(isUltra, isCritical) {
    if (!navigator.vibrate) return;

    if (isUltra) {
      navigator.vibrate([50, 40, 110]);
      return;
    }

    if (isCritical) {
      navigator.vibrate([40, 25, 55]);
      return;
    }

    navigator.vibrate(22);
  }

  function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  if (!started) {
    return (
      <div className="app intro">
        <h1>응원하기 👊</h1>
        <p>응원하고 싶은 캐릭터를 터치해보세요!</p>

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
          <h1>응원하기 👊</h1>
          <p>{nickname}</p>
        </div>

        <button className="small-button" onClick={resetGame}>
          리셋
        </button>
      </header>

      <section className="stats">
        <div>
          <span>응원</span>
          <b>{stats.hits}</b>
        </div>
        <div>
          <span>총 포인트</span>
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
        className={`stage ${impact}`}
        onContextMenu={(e) => e.preventDefault()}
      >
        {flash && <div className={`screen-flash ${flash}`} />}

        <div className="target-wrap">
          {speech && <div className="speech-bubble">{speech}</div>}

          <img
            className={`character ${reaction}`}
            src={CHARACTER_IMAGES[characterPose] || CHARACTER_IMAGES.normal}
            alt="character"
            draggable="false"
          />
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
            <div className="hit-damage">+{item.damage}</div>
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
        <div className="charge-label">꾹 눌러 응원 한방</div>
        <div className="charge-bar">
          <div style={{ width: `${chargePercent}%` }} />
        </div>
      </section>

      <section className="log">
        <b>응원 로그</b>
        {log.length === 0 && <p>캐릭터를 터치해 응원해봐!</p>}
        {log.map((item, index) => (
          <p key={`${item}-${index}`}>{item}</p>
        ))}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
