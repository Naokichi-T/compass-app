// ============================================================
// 短縮URLを展開するAPIルート
// maps.app.goo.gl などの短縮URLにアクセスして
// リダイレクト先の完全なURLを返す
// ============================================================

export async function GET({ url }) {
  // クエリパラメータからURLを取得
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "URLが指定されていません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // リダイレクトを追わずにレスポンスヘッダーだけ取得する
    const response = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow", // リダイレクトを自動で追う
    });

    // 最終的なURLを返す
    return new Response(JSON.stringify({ expandedUrl: response.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "URL展開に失敗しました: " + e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
