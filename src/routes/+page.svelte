<script>
  // ============================================================
  // コンパス画面
  // 現在地と目的地の座標から、矢印で方向を示す
  // ============================================================

  // --- テスト用の目的地（川越駅） ---
  const DEST_LAT = 35.9071163;
  const DEST_LNG = 139.4824443;
  const DEST_NAME = "川越駅";

  // --- 状態変数 ---
  let currentLat = $state(null); // 現在地の緯度
  let currentLng = $state(null); // 現在地の経度
  let heading = $state(null); // スマホが向いている方角（度）
  let permission = $state("idle"); // センサーの許可状態: idle / granted / denied / unsupported
  let errorMsg = $state(""); // エラーメッセージ

  // ============================================================
  // 2点間の距離を計算する（Haversine公式）
  // 地球が球体であることを考慮した計算方法
  // ============================================================
  function calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球の半径（メートル）
    const rad = (deg) => (deg * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  }

  // ============================================================
  // 目的地の方角を計算する（北を0°として時計回り）
  // ============================================================
  function calcBearing(lat1, lng1, lat2, lng2) {
    const rad = (deg) => (deg * Math.PI) / 180;
    const dLng = rad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(rad(lat2));
    const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  // --- 計算結果（derived） ---
  // 現在地から目的地までの距離（メートル）
  let distance = $derived(currentLat !== null ? calcDistance(currentLat, currentLng, DEST_LAT, DEST_LNG) : null);

  // 目的地の方角（北基準）
  let bearing = $derived(currentLat !== null ? calcBearing(currentLat, currentLng, DEST_LAT, DEST_LNG) : null);

  // 矢印の回転角度（スマホの向きを引いた相対角度）
  let arrowAngle = $derived(bearing !== null && heading !== null ? (bearing - heading + 360) % 360 : null);

  // ============================================================
  // 距離を見やすい文字列に変換する
  // 1000m以上はkmで表示
  // ============================================================
  function formatDistance(m) {
    if (m === null) return "--";
    if (m >= 1000) return (m / 1000).toFixed(1) + " km";
    return Math.round(m) + " m";
  }

  // ============================================================
  // センサーの開始処理
  // iPhoneはユーザー操作が必要なためボタンで起動する
  // ============================================================
  async function startSensors() {
    // --- GPS（現在地）の取得 ---
    if (!navigator.geolocation) {
      errorMsg = "このブラウザはGPSに対応していません";
      permission = "unsupported";
      return;
    }

    // GPS監視を開始（位置が変わるたびに更新）
    navigator.geolocation.watchPosition(
      (pos) => {
        currentLat = pos.coords.latitude;
        currentLng = pos.coords.longitude;
      },
      (err) => {
        errorMsg = "GPS取得エラー: " + err.message;
        permission = "denied";
      },
      { enableHighAccuracy: true },
    );

    // --- 方位センサーの取得 ---
    // iPhoneはDeviceOrientationEventの許可が必要
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      // iPhone の場合
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") {
          errorMsg = "方位センサーの許可が必要です";
          permission = "denied";
          return;
        }
      } catch (e) {
        errorMsg = "方位センサーの許可に失敗しました";
        permission = "denied";
        return;
      }
    }

    // 方位センサーのイベントを監視
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);

    permission = "granted";
  }

  // ============================================================
  // 方位センサーのイベントを受け取る
  // alphaは北を基準にした角度（ブラウザ・機種によって挙動が違う）
  // ============================================================
  function onOrientation(e) {
    // webkitCompassHeadingはiPhone用（北=0°の絶対値）
    if (e.webkitCompassHeading !== undefined) {
      heading = e.webkitCompassHeading;
    } else if (e.absolute && e.alpha !== null) {
      // Androidの絶対方位
      heading = (360 - e.alpha) % 360;
    }
  }
</script>

<div class="container">
  <h1 class="title">🧭 コンパス</h1>

  {#if permission === "idle"}
    <!-- センサー開始前 -->
    <div class="card">
      <p class="dest-name">目的地：{DEST_NAME}</p>
      <button class="start-btn" onclick={startSensors}> 📍 コンパスを起動する </button>
      <p class="note">※ GPSと方位センサーの許可が必要です</p>
    </div>
  {:else if permission === "denied" || permission === "unsupported"}
    <!-- エラー -->
    <div class="card error">
      <p>⚠️ {errorMsg}</p>
      <button onclick={startSensors}>もう一度試す</button>
    </div>
  {:else}
    <!-- コンパス表示 -->
    <div class="card">
      <p class="dest-name">目的地：{DEST_NAME}</p>
      <p class="distance">{formatDistance(distance)}</p>

      <!-- 矢印 -->
      <div class="arrow-wrap">
        {#if arrowAngle !== null}
          <div class="arrow" style="transform: rotate({arrowAngle}deg)">▲</div>
        {:else}
          <div class="arrow-loading">取得中...</div>
        {/if}
      </div>

      <!-- デバッグ情報（開発中だけ表示） -->
      <div class="debug">
        <p>現在地: {currentLat?.toFixed(5) ?? "--"}, {currentLng?.toFixed(5) ?? "--"}</p>
        <p>向き: {heading?.toFixed(1) ?? "--"}°</p>
        <p>目的地方角: {bearing?.toFixed(1) ?? "--"}°</p>
        <p>矢印角度: {arrowAngle?.toFixed(1) ?? "--"}°</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #f0f4f8;
    padding: 20px;
    box-sizing: border-box;
  }

  .title {
    font-size: 24px;
    margin-bottom: 24px;
    color: #333;
  }

  .card {
    background: white;
    border-radius: 20px;
    padding: 32px 24px;
    width: 90vw;
    max-width: 360px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  }

  .card.error {
    border: 2px solid #dc3545;
  }

  .dest-name {
    font-size: 18px;
    font-weight: bold;
    color: #333;
    margin-bottom: 8px;
  }

  .distance {
    font-size: 36px;
    font-weight: bold;
    color: #2a7ae2;
    margin: 8px 0 24px;
  }

  .arrow-wrap {
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* 矢印：文字で表現してCSSで回転させる */
  .arrow {
    font-size: 100px;
    color: #2a7ae2;
    line-height: 1;
    transition: transform 0.3s ease; /* なめらかに回転 */
  }

  .arrow-loading {
    font-size: 18px;
    color: #999;
  }

  .start-btn {
    background: #2a7ae2;
    color: white;
    border: none;
    border-radius: 12px;
    padding: 16px 32px;
    font-size: 18px;
    cursor: pointer;
    margin: 16px 0;
  }

  .start-btn:hover {
    background: #1a5fbb;
  }

  .note {
    font-size: 13px;
    color: #999;
    margin-top: 8px;
  }

  /* デバッグ情報（薄く小さく表示） */
  .debug {
    margin-top: 24px;
    text-align: left;
    font-size: 11px;
    color: #bbb;
    line-height: 1.6;
  }
</style>
