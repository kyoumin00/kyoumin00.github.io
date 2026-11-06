// 서버 함수: 테마별 반응 횟수 조회
// 브라우저 → 이 함수 → Supabase RPC(theme_counts). secret 키는 이 서버에서만 사용한다.

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    res.status(500).json({ error: 'server not configured' });
    return;
  }

  try {
    // 집계는 Supabase RPC(theme_counts)가 DB 안에서 group by로 끝낸다.
    // 따라서 개별 행 조회 건수 제한(PostgREST 기본 1000행)에 걸리지 않고,
    // 투표가 아무리 많아도 테마 수만큼의 집계 행만 돌아온다 = 누락 없음.
    const r = await fetch(`${url}/rest/v1/rpc/theme_counts`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        // 혹시 모를 응답 상한에 대비해 넉넉히 허용 (집계 행은 소수라 사실상 영향 없음)
        'Accept-Profile': 'public',
        Range: '0-9999',
      },
      body: '{}',
    });

    if (!r.ok) {
      res.status(502).json({ error: 'db read failed' });
      return;
    }

    const data = await r.json();
    // 브라우저가 쓰기 쉬운 형태로 그대로 전달: [{theme, count}, ...]
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'upstream error' });
  }
}
