// ============================================================
// 場所名でGoogle Places API (New)（Text Search）を検索して候補を返すAPIルート
// ============================================================

import { GOOGLE_MAPS_API_KEY } from "$env/static/private";

export async function GET({ url }) {
  // クエリパラメータ ?q=川越駅 を取り出す
  const q = url.searchParams.get("q");

  if (!q) {
    return new Response(JSON.stringify({ error: "検索ワードが指定されていません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Places API (New) はPOSTリクエスト
    // FieldMaskで取得するフィールドを絞る（料金節約のため）
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        // 取得するフィールドをカンマ区切りで指定
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: q, // 検索ワード
        languageCode: "ja", // 日本語で返す
        maxResultCount: 10, // 最大10件
      }),
    });

    const data = await res.json();

    // placesキーがない＝検索結果0件
    if (!data.places) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 必要な情報だけ取り出して返す
    const results = data.places.map((place) => ({
      name: place.displayName?.text ?? "不明", // 場所名
      address: place.formattedAddress ?? "", // 住所
      lat: place.location.latitude, // 緯度
      lng: place.location.longitude, // 経度
    }));

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "検索に失敗しました: " + e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
