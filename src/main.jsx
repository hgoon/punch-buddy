import React, { useRef, useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import "./style.css";

const SUPABASE_URL = "https://ydgnnikfmesvosghsdeg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkZ25uaWtmbWVzdm9zZ2hzZGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MzI3NTcsImV4cCI6MjA5NzQwODc1N30.2fZgjUNFJVm3PrUsfqeO8Eu9UwyFoHYj9ao1Js6VFCg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VERSION = "v2.5";

const COMBO_LIMIT_MS = 500;
const MAX_HP = 10000;

// 세션 스탯 누적 후 N타마다 Supabase 동기화
const SYNC_INTERVAL = 10;

const ZONES = {
  head: {
    name: "머리", min: 8, max: 16, reaction: "hit-head", hitbox: "head-zone",
    weak: false, pose: "backHead",
    line: ["아!", "어우!", "머리 울려!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  face: {
    name: "얼굴", min: 11, max: 24, reaction: "hit-face", hitbox: "face-zone",
    weak: false, pose: "normal",
    line: ["으악!", "아야!", "얼굴은 반칙!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  philtrum: {
    name: "인중", min: 15, max: 30, reaction: "hit-face", hitbox: "philtrum-zone",
    weak: true, pose: "normal",
    line: ["끄억!", "인중은 안 돼!", "눈물 난다!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  chest: {
    name: "명치", min: 16, max: 32, reaction: "hit-body", hitbox: "chest-zone",
    weak: true, pose: "body",
    line: ["컥!", "숨 막혀!", "명치...!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  belly: {
    name: "배", min: 9, max: 19, reaction: "hit-body", hitbox: "belly-zone",
    weak: false, pose: "body",
    line: ["윽!", "배 아파!", "오우!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  groin: {
    name: "급소", min: 14, max: 28, reaction: "hit-groin", hitbox: "groin-zone",
    weak: true, pose: "body",
    line: ["으아아악!", "그건 아니지!", "잠깐만!!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
  leg: {
    name: "다리", min: 6, max: 14, reaction: "hit-leg", hitbox: "leg-zone",
    weak: false, pose: "normal",
    line: ["휘청!", "다리 풀린다!", "아야!", "내 안에 뭔가가 움직였다", "나를 버렸습니다.", "이게 팀이야"],
  },
};

const CHARACTER_IMAGES = {
  normal:   "/coach_red.png",
  backHead: "/coach_red2.png",
  body:     "/coach_red3.png",
  ko:       "/coach_red4.png",
  damaged:  "/coach_red5.png",
};

const RANK_TABS = [
  { key: "hits",         label: "응원왕", icon: "👊", unit: "회" },
  { key: "total_damage", label: "화력왕", icon: "🔥", unit: "pt" },
  { key: "ko_count",     label: "KO왕",  icon: "💀", unit: "KO" },
  { key: "best_combo",   label: "콤보왕", icon: "🔥", unit: "콤보" },
];

function App() {
  const pressStart    = useRef(0);
  const effectId      = useRef(1);
  const lastHitAt     = useRef(0);
  const comboResetTimer = useRef(null);
  const chargeRafRef  = useRef(null);
  const presenceRef   = useRef(null); // Supabase Realtime Presence 채널

  // 세션 중 누적된 델타 (Supabase에 아직 안 보낸 것)
  const sessionDelta  = useRef({ hits: 0, totalDamage: 0, koCount: 0, bestCombo: 0 });
  const syncTimer     = useRef(null);
  const koStartAt     = useRef(0); // 현재 라운드 첫 타격 시각
  const timerRafRef   = useRef(null); // 타이머 RAF
  const [roundTimer,  setRoundTimer] = useState(0); // 현재 라운드 경과시간 ms

  const [nickname, setNickname] = useState(localStorage.getItem("punch_nickname") || "");
  const [started,  setStarted]  = useState(!!localStorage.getItem("punch_nickname"));

  const [stats, setStats] = useState(() =>
    JSON.parse(localStorage.getItem("punch_stats") ||
      '{"hits":0,"totalDamage":0,"bestCombo":0,"combo":0,"koCount":0}')
  );

  const [hp,          setHp]          = useState(MAX_HP);
  const [isKO,        setIsKO]        = useState(false);
  const [isReviving,  setIsReviving]  = useState(false);
  const [koCount,     setKoCount]     = useState(
    () => JSON.parse(localStorage.getItem("punch_stats") || "{}").koCount || 0
  );

  const [log,            setLog]            = useState([]);
  const [reaction,       setReaction]       = useState("");
  const [impact,         setImpact]         = useState("");
  const [characterPose,  setCharacterPose]  = useState("normal");
  const [chargePercent,  setChargePercent]  = useState(0);
  const [charging,       setCharging]       = useState(false);
  const [chargeLevelLive,setChargeLevelLive]= useState(0);
  const [crosshairPos,   setCrosshairPos]   = useState({ x: 50, y: 50 }); // % 기준
  const [dodgeOffset,    setDodgeOffset]    = useState(0); // 캐릭터 좌우 이동 px
  const dodgeRafRef = useRef(null);
  const [missEffects,    setMissEffects]    = useState([]);
  const hitZoneTriggered = useRef(false); // 히트존에서 올라온 이벤트인지 추적
  const characterImgRef  = useRef(null);  // 캐릭터 img 태그 ref
  const canvasRef        = useRef(null);  // 픽셀 판정용 숨겨진 canvas
  const [floatingEffects,setFloatingEffects]= useState([]);
  const [speech,         setSpeech]         = useState("");
  const [isReviveSpeech, setIsReviveSpeech] = useState(false);
  const [flash,          setFlash]          = useState("");

  // 랭킹
  const [activeTab,    setActiveTab]   = useState("hits");
  const [ranking,      setRanking]     = useState([]);
  const [rankLoading,  setRankLoading] = useState(false);
  const [showRanking,  setShowRanking] = useState(false);
  const [onlineCount,  setOnlineCount] = useState(1);

  // ── Supabase 동기화 ─────────────────────────────
  const syncToSupabase = useCallback(async (nick, delta) => {
    if (!nick || (delta.hits === 0 && delta.totalDamage === 0 && delta.koCount === 0 && delta.bestCombo === 0)) return;
    try {
      await supabase.rpc("upsert_cheer_stats", {
        p_nickname:     nick,
        p_hits:         delta.hits,
        p_total_damage: delta.totalDamage,
        p_ko_count:     delta.koCount,
        p_best_combo:   delta.bestCombo,
      });
      sessionDelta.current = { hits: 0, totalDamage: 0, koCount: 0, bestCombo: 0 };
    } catch (e) {
      console.warn("sync error", e);
    }
  }, []);

  // 페이지 종료 시 남은 델타 동기화
  useEffect(() => {
    const flush = () => syncToSupabase(nickname, sessionDelta.current);
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide",     flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide",     flush);
    };
  }, [nickname, syncToSupabase]);

  // ── HP 낮을 때 캐릭터 회피 이동 ────────────────
  useEffect(() => {
    const ratio = hp / MAX_HP;

    // 25% 이하이고 KO/재선임 중 아닐 때만 작동
    if (ratio > 0.25 || isKO || isReviving || hp === 0) {
      if (dodgeRafRef.current) {
        cancelAnimationFrame(dodgeRafRef.current);
        dodgeRafRef.current = null;
      }
      setDodgeOffset(0);
      return;
    }

    // HP 낮을수록 빠르게: 25%→속도1, 10%→속도3, 0%→속도5
    const speed = 1 + (1 - ratio / 0.25) * 4;
    const range = 28; // 최대 이동 범위 px
    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const offset = Math.sin(elapsed * speed * Math.PI) * range;
      setDodgeOffset(offset);
      dodgeRafRef.current = requestAnimationFrame(tick);
    }

    dodgeRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (dodgeRafRef.current) {
        cancelAnimationFrame(dodgeRafRef.current);
        dodgeRafRef.current = null;
      }
    };
  }, [hp, isKO, isReviving]);
  useEffect(() => {
    if (!started || !nickname) return;

    const channel = supabase.channel("cheer_online", {
      config: { presence: { key: nickname } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ nickname, online_at: new Date().toISOString() });
        }
      });

    presenceRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [started, nickname]);
  async function fetchRanking(tab) {
    setRankLoading(true);
    try {
      const { data, error } = await supabase
        .from("cheer_ranking")
        .select("nickname, hits, total_damage, ko_count, best_combo")
        .order(tab, { ascending: false, nullsFirst: false })
        .limit(20);
      if (!error) setRanking(data || []);
    } catch (e) {
      console.warn("ranking error", e);
    }
    setRankLoading(false);
  }

  function openRanking() {
    setShowRanking(true);
    fetchRanking(activeTab);
  }

  function switchTab(tab) {
    setActiveTab(tab);
    fetchRanking(tab);
  }

  // ── 게임 시작 ───────────────────────────────────
  async function startGame() {
    const cleanName = nickname.trim();
    if (!cleanName) { alert("닉네임을 입력해줘!"); return; }
    localStorage.setItem("punch_nickname", cleanName);
    setNickname(cleanName);
    setStarted(true);
    try {
      await supabase.rpc("register_cheer_user", { p_nickname: cleanName });
    } catch (e) { console.warn("register error", e); }
  }

  // ── 리셋 ────────────────────────────────────────
  function resetGame() {
    // 남은 델타 먼저 동기화
    syncToSupabase(nickname, sessionDelta.current);

    const resetStats = { hits: 0, totalDamage: 0, bestCombo: 0, combo: 0, koCount: 0 };
    localStorage.setItem("punch_stats", JSON.stringify(resetStats));
    setStats(resetStats);
    setKoCount(0);
    setHp(MAX_HP);
    setIsKO(false);
    setIsReviving(false);
    setLog([]);
    setReaction(""); setImpact(""); setCharacterPose("normal");
    setChargePercent(0); setCharging(false);
    setFloatingEffects([]); setSpeech(""); setIsReviveSpeech(false); setFlash("");
    lastHitAt.current = 0;
    koStartAt.current = 0;
    setRoundTimer(0);
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = null;
    }
    sessionDelta.current = { hits: 0, totalDamage: 0, koCount: 0, bestCombo: 0 };
    if (comboResetTimer.current) { clearTimeout(comboResetTimer.current); comboResetTimer.current = null; }
  }

  // ── 차지 ────────────────────────────────────────
  function startCharge(event) {
    event.preventDefault();
    pressStart.current = Date.now();
    setCharging(true);
    setChargePercent(100);
    setChargeLevelLive(0);

    // 조준경 초기 위치 설정
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setCrosshairPos({ x, y });
    function tick() {
      const elapsed = Date.now() - pressStart.current;
      let level = 0;
      if (elapsed >= 2200) level = 4;
      else if (elapsed >= 1500) level = 3;
      else if (elapsed >= 800) level = 2;
      else if (elapsed >= 300) level = 1;
      setChargeLevelLive(level);
      chargeRafRef.current = requestAnimationFrame(tick);
    }
    chargeRafRef.current = requestAnimationFrame(tick);
  }

  function cancelCharge() {
    setChargePercent(0); setCharging(false); setChargeLevelLive(0);
    if (chargeRafRef.current) { cancelAnimationFrame(chargeRafRef.current); chargeRafRef.current = null; }
  }

  // ── 타격 ────────────────────────────────────────
  function endCharge(zoneKey, event) {
    event.preventDefault();
    hitZoneTriggered.current = true;
    if (isKO || isReviving) return;

    const zone = ZONES[zoneKey];
    if (!zone) return;

    // stage 기준 좌표 (hitzone-wrap이 이동해도 stage는 고정)
    const stage  = event.currentTarget.closest(".stage");
    const rect   = stage ? stage.getBoundingClientRect() : event.currentTarget.parentElement.getBoundingClientRect();

    // 손가락 뗄 때 위치 기준 (onPointerUp의 실제 좌표)
    const touchX = event.clientX - rect.left;
    const rawY   = event.clientY - rect.top;

    // lv2(800ms) 이상 차지 시 조준경 오프셋만큼 위로 보정
    const CROSSHAIR_OFFSET_RATIO = 0.4;
    const touchY = chargeLevelLive >= 2
      ? rawY - rect.height * CROSSHAIR_OFFSET_RATIO
      : rawY;

    const now = Date.now();
    const isComboContinuing = now - lastHitAt.current <= COMBO_LIMIT_MS;
    const nextCombo = isComboContinuing ? stats.combo + 1 : 1;
    lastHitAt.current = now;

    if (comboResetTimer.current) clearTimeout(comboResetTimer.current);
    comboResetTimer.current = setTimeout(() => {
      setStats((prev) => { const next = { ...prev, combo: 0 }; localStorage.setItem("punch_stats", JSON.stringify(next)); return next; });
    }, COMBO_LIMIT_MS);

    const holdTime = Math.min(now - pressStart.current, 2600);
    let chargeMultiplier = 1, chargeLevel = "normal";
    if      (holdTime >= 2200) { chargeMultiplier = random(8, 10); chargeLevel = "max"; }
    else if (holdTime >= 1500) { chargeMultiplier = random(5, 7);  chargeLevel = "big"; }
    else if (holdTime >= 800)  { chargeMultiplier = random(3, 4);  chargeLevel = "medium"; }
    else if (holdTime >= 300)  { chargeMultiplier = 2;             chargeLevel = "small"; }

    const baseDamage = random(zone.min, zone.max);
    const weakBonus  = zone.weak ? 0.16 : 0;
    const comboBonus = Math.min(nextCombo * 0.02, 0.2);
    const isCritical = Math.random() < 0.12 + weakBonus + comboBonus;
    const isUltra    = chargeLevel === "max" ||
      (chargeLevel === "big" && Math.random() < 0.45 + weakBonus) ||
      (holdTime > 1300 && Math.random() < 0.22 + weakBonus);

    let damage = Math.floor(baseDamage * chargeMultiplier);
    if (isCritical) damage *= 3;
    if (isUltra)    damage *= 5;

    // 첫 타격 시각 기록 (라운드 시작) + 타이머 시작
    if (koStartAt.current === 0) {
      koStartAt.current = now;
      function tickTimer() {
        setRoundTimer(Date.now() - koStartAt.current);
        timerRafRef.current = requestAnimationFrame(tickTimer);
      }
      timerRafRef.current = requestAnimationFrame(tickTimer);
    }

    const newBestCombo = Math.max(stats.bestCombo || 0, nextCombo);

    const nextStats = {
      hits:        stats.hits + 1,
      totalDamage: stats.totalDamage + damage,
      bestCombo:   newBestCombo,
      combo:       nextCombo,
      koCount:     stats.koCount || 0,
    };
    setStats(nextStats);
    localStorage.setItem("punch_stats", JSON.stringify(nextStats));

    // 세션 델타 누적
    const d = sessionDelta.current;
    d.hits        += 1;
    d.totalDamage += damage;
    d.bestCombo    = Math.max(d.bestCombo, nextCombo);

    // SYNC_INTERVAL 타마다 자동 동기화
    if (nextStats.hits % SYNC_INTERVAL === 0) {
      syncToSupabase(nickname, { ...d });
    }

    setHp((prevHp) => {
      const nextHp = Math.max(0, prevHp - damage);
      if (nextHp === 0 && !isKO) triggerKO(nextStats);
      return nextHp;
    });

    const nextReaction = isUltra ? "super-critical" : isCritical ? "critical" : zone.reaction;
    const nextImpact   = isUltra ? "impact-ultra" : isCritical ? "impact-critical" :
      zone.pose === "body" ? "impact-body" : "impact-small";

    setReaction(nextReaction);
    setImpact(chargeLevel === "max" ? "impact-ultra" : chargeLevel === "big" ? "impact-critical" : nextImpact);
    setCharacterPose(zone.pose || "normal");
    cancelCharge();

    addFloatingEffect({ x: touchX, y: touchY, damage, critical: isCritical, ultra: isUltra, combo: nextCombo, chargeLevel });
    showSpeech(zone, isCritical, isUltra || chargeLevel === "max");
    showFlash(isCritical, isUltra);
    vibrate(isUltra, isCritical);

    const message = isUltra ? `🔥 ${zone.name} 풀차지 응원! ${damage} 포인트`
      : chargeLevel === "big" ? `⚡ ${zone.name} 강력 응원! ${damage} 포인트`
      : isCritical            ? `💥 ${zone.name} 크리티컬 응원! ${damage} 포인트`
      :                         `👊 ${zone.name} 응원! ${damage} 포인트`;
    setLog((prev) => [message, ...prev].slice(0, 7));

    setTimeout(() => {
      setReaction(""); setImpact("");
      setCharacterPose((prev) => prev === "ko" ? "ko" : "normal");
    }, isUltra ? 720 : 480);
  }

  // ── KO ──────────────────────────────────────────
  function triggerKO(latestStats) {
    setIsKO(true);
    setCharacterPose("ko");
    cancelCharge();

    // 타이머 정지
    if (timerRafRef.current) {
      cancelAnimationFrame(timerRafRef.current);
      timerRafRef.current = null;
    }

    const nextKoCount = (latestStats.koCount || 0) + 1;
    const nextStats   = { ...latestStats, koCount: nextKoCount };
    setStats(nextStats);
    setKoCount(nextKoCount);
    localStorage.setItem("punch_stats", JSON.stringify(nextStats));

    // KO 시 즉시 동기화
    const d = sessionDelta.current;
    d.koCount += 1;
    syncToSupabase(nickname, { ...d });
    sessionDelta.current = { hits: 0, totalDamage: 0, koCount: 0, bestCombo: 0 };

    // 다음 라운드를 위해 초기화
    koStartAt.current = 0;
    setRoundTimer(0);

    vibrate(true, false);

    setTimeout(() => { setIsKO(false); setIsReviving(true); setCharacterPose("normal"); }, 3000);
    setTimeout(() => {
      setIsReviving(false);
      setHp(MAX_HP);
      setSpeech("내 안에 뭔가가 나를 움직여 다시 왔습니다.");
      setIsReviveSpeech(true);
      setTimeout(() => { setSpeech(""); setIsReviveSpeech(false); }, 2000);
    }, 5000);
  }

  // ── 이펙트 헬퍼 ─────────────────────────────────
  function addFloatingEffect({ x, y, damage, critical, ultra, combo, chargeLevel }) {
    const id = effectId.current++;
    setFloatingEffects((prev) => [...prev, {
      id, x, y, damage, critical, ultra, combo,
      label: ultra ? "ULTRA!" : chargeLevel === "big" || chargeLevel === "max" ? "POWER!" : critical ? "CRITICAL!" : "HIT!",
      emoji: ultra ? "💥" : chargeLevel === "big" || chargeLevel === "max" ? "⚡" : critical ? "💢" : "👊",
      chargeLevel,
    }]);
    setTimeout(() => setFloatingEffects((prev) => prev.filter((i) => i.id !== id)), 850);
  }

  // ── 조준경 좌표 기준으로 해당 존 찾기 (DOM + dodgeOffset 보정) ──
  function getZoneAtPercent(clientX, clientY) {
    for (const [key, zone] of Object.entries(ZONES)) {
      const el = document.querySelector(`.${zone.hitbox}`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      // dodgeOffset만큼 히트존이 이동해 있으므로 보정
      const left  = r.left  + dodgeOffset;
      const right = r.right + dodgeOffset;
      if (clientX >= left && clientX <= right && clientY >= r.top && clientY <= r.bottom) {
        return key;
      }
    }
    return null;
  }

  // ── 픽셀 판정: 터치 위치가 캐릭터 실제 픽셀인지 확인 ──
  function isPixelHit(clientX, clientY) {
    const img = characterImgRef.current;
    if (!img) return true; // 이미지 없으면 히트로 처리

    const imgRect = img.getBoundingClientRect();

    // 이미지 영역 밖이면 바로 MISS
    if (
      clientX < imgRect.left || clientX > imgRect.right ||
      clientY < imgRect.top  || clientY > imgRect.bottom
    ) return false;

    // 이미지 내 상대 좌표 → 실제 픽셀 좌표로 변환
    const scaleX = img.naturalWidth  / imgRect.width;
    const scaleY = img.naturalHeight / imgRect.height;
    const px = Math.floor((clientX - imgRect.left) * scaleX);
    const py = Math.floor((clientY - imgRect.top)  * scaleY);

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // canvas 크기가 이미지와 다르면 다시 그리기
      if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      }

      const pixel = ctx.getImageData(px, py, 1, 1).data;
      return pixel[3] > 30; // 알파값 30 이상이면 히트
    } catch (e) {
      return true; // CORS 등 오류 시 히트로 처리
    }
  }

  function triggerMiss(x, y) {
    // 콤보 초기화
    setStats((prev) => {
      const next = { ...prev, combo: 0 };
      localStorage.setItem("punch_stats", JSON.stringify(next));
      return next;
    });
    if (comboResetTimer.current) {
      clearTimeout(comboResetTimer.current);
      comboResetTimer.current = null;
    }

    // MISS 이펙트 표시
    const id = effectId.current++;
    setMissEffects((prev) => [...prev, { id, x, y }]);
    setTimeout(() => setMissEffects((prev) => prev.filter((i) => i.id !== id)), 700);
  }

  function showSpeech(zone, isCritical, isUltra) {
    const lines = isUltra
      ? ["으아아악!!", "잠깐만!!", "너무 강해!!", "내 안에 뭔가가 움직였다"]
      : isCritical
      ? ["악!!", "크윽!!", "제대로 들어왔다!", "나를 버렸습니다.", "이게 팀이야"]
      : zone.line;
    setSpeech(lines[random(0, lines.length - 1)]);
    setTimeout(() => setSpeech(""), 820);
  }

  function showFlash(isCritical, isUltra) {
    if (!isCritical && !isUltra) return;
    setFlash(isUltra ? "ultra-flash" : "critical-flash");
    setTimeout(() => setFlash(""), isUltra ? 130 : 90);
  }

  function vibrate(isUltra, isCritical) {
    if (!navigator.vibrate) return;
    if (isUltra)    { navigator.vibrate([50, 40, 110]); return; }
    if (isCritical) { navigator.vibrate([40, 25, 55]);  return; }
    navigator.vibrate(22);
  }

  function random(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // ── 랭킹 탭 값 ──────────────────────────────────
  function getRankValue(row, tabKey) {
    const map = {
      hits:         row.hits,
      total_damage: row.total_damage,
      ko_count:     row.ko_count,
      best_combo:   row.best_combo,
    };
    return (map[tabKey] ?? 0).toLocaleString();
  }

  // ── 인트로 ──────────────────────────────────────
  if (!started) {
    return (
      <div className="app intro">
        <h1>응원하기 👊</h1>
        <p>응원하고 싶은 캐릭터를 터치해보세요!</p>
        <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임 입력" maxLength={12} />
        <button className="primary-button" onClick={startGame}>게임 시작</button>
      </div>
    );
  }

  // ── 랭킹 화면 ───────────────────────────────────
  if (showRanking) {
    const tabInfo = RANK_TABS.find((t) => t.key === activeTab);
    return (
      <div className="app ranking-screen" onContextMenu={(e) => e.preventDefault()}>
        <header className="top">
          <div>
            <h1>랭킹 🏆</h1>
            <p>{nickname}</p>
          </div>
          <button className="small-button" onClick={() => setShowRanking(false)}>돌아가기</button>
        </header>

        <div className="rank-tabs">
          {RANK_TABS.map((t) => (
            <button key={t.key} className={`rank-tab ${activeTab === t.key ? "active" : ""}`} onClick={() => switchTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="rank-list">
          {rankLoading ? (
            <div className="rank-loading">불러오는 중…</div>
          ) : ranking.length === 0 ? (
            <div className="rank-empty">아직 기록이 없어요</div>
          ) : (
            ranking.map((row, idx) => (
              <div key={row.nickname} className={`rank-row ${row.nickname === nickname ? "my-row" : ""}`}>
                <span className={`rank-num ${idx === 0 ? "gold" : idx === 1 ? "silver" : idx === 2 ? "bronze" : ""}`}>
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                </span>
                <span className="rank-nick">
                  {row.nickname}
                  {row.nickname === nickname && <span className="me-tag">나 👈</span>}
                </span>
                <span className="rank-val">{getRankValue(row, activeTab)} <em>{tabInfo.unit}</em></span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── 메인 게임 화면 ───────────────────────────────
  return (
    <div className="app" onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} onSelect={(e) => e.preventDefault()}>
      <header className="top">
        <div>
          <h1>응원하기 👊 <span className="version-tag">{VERSION}</span></h1>
          <p>{nickname} <span className="online-badge">🟢 {onlineCount}명 접속 중</span></p>
        </div>
        <div className="top-buttons">
          <button className="small-button rank-button" onClick={openRanking}>🏆 랭킹</button>
        </div>
      </header>

      {/* HP Bar */}
      <section className="hp-section">
        <div className="hp-label-row">
          <span className="hp-title">HP</span>
          <span className="hp-value">{hp} / {MAX_HP}</span>
        </div>
        <div className="hp-bar-track">
          <div
            className={`hp-bar-fill ${hp / MAX_HP > 0.5 ? "hp-green" : hp / MAX_HP > 0.25 ? "hp-yellow" : hp > 0 ? "hp-red" : "hp-empty"}`}
            style={{ width: `${(hp / MAX_HP) * 100}%` }}
          />
        </div>
      </section>

      <section className="stats">
        <div><span>응원</span><b>{stats.hits}</b></div>
        <div><span>KO</span><b>{koCount}</b></div>
        <div><span>총 포인트</span><b>{stats.totalDamage}</b></div>
        <div><span>콤보</span><b>{stats.combo}</b></div>
      </section>

      {/* 픽셀 판정용 숨겨진 canvas */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <main
        className={`stage ${impact} ${charging ? "charging" : ""}`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerMove={(event) => {
          if (!charging) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          setCrosshairPos({ x, y });
        }}
        onPointerUp={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;

          if (!isKO && !isReviving && !hitZoneTriggered.current) {
            // 히트존 밖 터치 → 픽셀 판정 후 MISS
            if (!isPixelHit(e.clientX, e.clientY)) {
              triggerMiss(x, y);
            }
          }
          hitZoneTriggered.current = false;
          cancelCharge();
        }}
      >
        {flash && <div className={`screen-flash ${flash}`} />}
        {charging && <div className={`charge-power charge-power-${chargeLevelLive}`}>POWER</div>}

        {/* 조준경 - lv2(800ms) 이상일 때만 표시 */}
        {charging && chargeLevelLive >= 2 && (
          <div
            className={`crosshair lv${chargeLevelLive}`}
            style={{
              position: "absolute",
              left: `${crosshairPos.x}%`,
              top:  `${crosshairPos.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 19,
              pointerEvents: "none",
            }}
          >
            <div className="crosshair-center" />
            <div className="crosshair-line crosshair-h" />
            <div className="crosshair-line crosshair-v" />
          </div>
        )}

        {/* 라운드 타이머 */}
        {koStartAt.current > 0 && !isKO && !isReviving && (
          <div className="round-timer">
            ⏱ {(roundTimer / 1000).toFixed(2)}s
          </div>
        )}

        <div
          className="target-wrap"
          style={{ transform: `translateX(calc(-50% + ${dodgeOffset}px))` }}
        >
          {speech && <div className={`speech-bubble${isReviveSpeech ? " revive" : ""}`}>{speech}</div>}
          <img
            ref={characterImgRef}
            className={`character ${reaction}`}
            src={
              characterPose === "ko"
                ? CHARACTER_IMAGES.ko
                : hp / MAX_HP <= 0.25 && characterPose === "normal"
                ? CHARACTER_IMAGES.damaged
                : CHARACTER_IMAGES[characterPose] || CHARACTER_IMAGES.normal
            }
            alt="character"
            draggable="false"
            onLoad={() => {
              // 이미지 바뀌면 canvas 초기화해서 다시 그리도록
              const canvas = canvasRef.current;
              if (canvas) { canvas.width = 0; canvas.height = 0; }
            }}
            crossOrigin="anonymous"
          />
        </div>

        {floatingEffects.map((item) => (
          <div key={item.id}
            className={`floating-effect ${item.ultra ? "ultra-effect" : item.chargeLevel === "big" || item.chargeLevel === "max" ? "power-effect" : item.critical ? "critical-effect" : ""}`}
            style={{ left: item.x, top: item.y }}
          >
            <div className="hit-emoji">{item.emoji}</div>
            <div className="hit-label">{item.label}</div>
            <div className="hit-damage">+{item.damage}</div>
            {item.combo >= 2 && <div className="hit-combo">{item.combo} COMBO</div>}
          </div>
        ))}

        {/* MISS 이펙트 */}
        {missEffects.map((item) => (
          <div key={item.id} className="miss-effect" style={{ left: item.x, top: item.y }}>
            MISS
          </div>
        ))}

        {(isKO || isReviving) && (
          <div className={`ko-overlay ${isReviving ? "reviving" : "ko-active"}`}>
            {isKO ? (<><div className="ko-text">K.O!!</div><div className="ko-sub">재선임 중…</div></>)
                  : (<><div className="ko-revive-text">재선임 완료!</div><div className="ko-sub">새 감독 등장 🔴</div></>)}
          </div>
        )}

        <div
          className="hitzone-wrap"
          style={{ transform: `translateX(${dodgeOffset}px)` }}
        >
          {Object.entries(ZONES).map(([key, zone]) => (
            <button key={key} aria-label={`${zone.name} hit zone`} className={`hit-zone ${zone.hitbox}`}
              onPointerDown={startCharge}
              onPointerUp={(event) => endCharge(key, event)}
              onPointerCancel={cancelCharge}
            />
          ))}
        </div>
      </main>

      <section className="charge-box">
        <div className="charge-label">꾹 눌러 응원 한방</div>
        <div className="charge-bar"><div style={{ width: `${chargePercent}%` }} /></div>
      </section>

      <section className="log">
        <b>응원 로그</b>
        {log.length === 0 && <p>캐릭터를 터치해 응원해봐!</p>}
        {log.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
