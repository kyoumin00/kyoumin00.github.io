// 서버 함수: 테마 투표 저장
// 브라우저 → 이 함수 → Supabase. secret 키는 이 서버에서만 사용한다.
// 비밀 키는 RLS를 우회하므로, "허용된 테마인지" 검증은 서버가 책임진다.

const ALLOWED_THEMES = ['드라이브', '공부·집중', '운동', '밤 산책', '카페', '잠들기 전'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    res.status(500).json({ error: 'server not configured' });
    return;
  }

  // 요청 바디 파싱 (문자열로 올 수도 있어 방어적으로 처리)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const theme = body && typeof body.theme === 'string' ? body.theme : null;

  // 서버 측 검증: 허용된 테마만 통과 (secret 키는 RLS를 우회하므로 여기서 꼭 막는다)
  if (!theme || !ALLOWED_THEMES.includes(theme)) {
    res.status(400).json({ error: 'invalid theme' });
    return;
  }

  try {
    const r = await fetch(`${url}/rest/v1/theme_votes`, {
      method: 'POST',
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ theme }),
    });

    if (!r.ok) {
      const detail = await r.text();
      res.status(502).json({ error: 'db insert failed', detail });
      return;
    }

    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'upstream error' });
  }
}
