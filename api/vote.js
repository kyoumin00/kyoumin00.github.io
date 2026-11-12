// 서버 함수: 테마 투표 저장
// 브라우저 → 이 함수 → Supabase. secret 키는 이 서버에서만 사용한다.
// 비밀 키는 RLS를 우회하므로, "허용된 테마인지" 검증은 서버가 책임진다.

const ALLOWED_THEMES = ['발라드', '댄스', '알앤비', '힙합', '록', '인디'];
// 고정 목록이라 길이는 사실상 짧지만, 방어 깊이를 위해 상한을 둔다.
const MAX_THEME_LENGTH = 20;

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

  // 서버 측 검증 (secret 키는 RLS를 우회하므로 여기서 모두 막는다)
  const raw = body ? body.theme : undefined;

  // 1) 타입: 문자열이 아니면 거부 (빈 값·null·숫자·객체 등)
  if (typeof raw !== 'string') {
    res.status(400).json({ error: 'invalid theme' });
    return;
  }
  const theme = raw.trim();

  // 2) 빈 값 거부
  if (theme.length === 0) {
    res.status(400).json({ error: 'empty theme' });
    return;
  }

  // 3) 너무 긴 입력 거부 (방어 깊이)
  if (theme.length > MAX_THEME_LENGTH) {
    res.status(400).json({ error: 'theme too long' });
    return;
  }

  // 4) 화이트리스트: 허용된 테마만 통과
  if (!ALLOWED_THEMES.includes(theme)) {
    res.status(400).json({ error: 'theme not allowed' });
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
