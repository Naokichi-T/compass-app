// ============================================================
// 短縮URLを展開して座標を返すAPIルート
// 短縮URL → 展開 → 座標抽出 → なければPlace IDからGeocoding API
// ============================================================

import { GOOGLE_MAPS_API_KEY } from "$env/static/private";

// ============================================================
// GoogleマップのURLから座標を取り出す（正規表現）
// ============================================================
function extractCoordsFromUrl(url) {
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

// ============================================================
// URLからplace IDを取り出す
// 例: data=!4m2!3m1!1s0x6018...:0xd214... の形式
// ============================================================
function extractPlaceId(url) {
  // !1s の後に続く 0x形式のplace IDを探す
  const match = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/);
  if (match) return match[1];
  return null;
}

// ============================================================
// place IDからGeocoding APIで座標を取得する
// ============================================================
async function coordsFromPlaceId(placeId) {
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?place_id=${encodeURIComponent(placeId)}&key=${GOOGLE_MAPS_API_KEY}`);
  const data = await res.json();
  if (data.status === "OK" && data.results.length > 0) {
    const loc = data.results[0].geometry.location;
    const name = data.results[0].formatted_address;
    return { lat: loc.lat, lng: loc.lng, name };
  }
  return null;
}

export async function GET({ url }) {
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "URLが指定されていません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 短縮URLを展開する
    const response = await fetch(targetUrl, { redirect: "follow" });
    const expandedUrl = response.url;
    console.log("展開後URL:", expandedUrl);

    // ① まず展開後URLから座標を取り出す
    const coords = extractCoordsFromUrl(expandedUrl);
    if (coords) {
      return new Response(JSON.stringify({ ...coords, name: "目的地" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ② 座標がなければplace IDからGeocoding APIで取得する
    const placeId = extractPlaceId(expandedUrl);
    console.log("place ID:", placeId);

    if (placeId) {
      const result = await coordsFromPlaceId(placeId);
      if (result) {
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // ③ どちらも取れなかった場合
    return new Response(JSON.stringify({ error: "URLから座標を取り出せませんでした" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "URL展開に失敗しました: " + e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
