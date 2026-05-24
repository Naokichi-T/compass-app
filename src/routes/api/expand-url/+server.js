// ============================================================
// 短縮URLを展開して座標を返すAPIルート
// 短縮URL → 展開 → 座標抽出 → なければ場所名でPlaces API検索
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
// GoogleマップのURLから場所名を取り出す
// URLの /place/場所名/ の部分をデコードして返す
// ============================================================
function extractPlaceName(url) {
  const match = url.match(/\/place\/([^/]+)\//);
  if (match) {
    return decodeURIComponent(match[1]).replace(/\+/g, " ");
  }
  return null;
}

// ============================================================
// 場所名でPlaces APIを検索して座標を取得する
// ============================================================
async function coordsFromPlaceName(placeName) {
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(placeName)}&language=ja&key=${GOOGLE_MAPS_API_KEY}`);
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

    // ① まず展開後URLから座標を取り出す
    const coords = extractCoordsFromUrl(expandedUrl);
    if (coords) {
      // 場所名も取り出して一緒に返す
      const placeName = extractPlaceName(expandedUrl);
      return new Response(JSON.stringify({ ...coords, name: placeName ?? "目的地" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ② 座標がなければ場所名でGeocoding APIを使う
    const placeName = extractPlaceName(expandedUrl);

    if (placeName) {
      const result = await coordsFromPlaceName(placeName);
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
