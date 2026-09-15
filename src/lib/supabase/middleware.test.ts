import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChunks, stringToBase64URL } from '@supabase/ssr';
import { AuthClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { updateSession } from './middleware';

test('rejeição do SDK é falha técnica sem limpar a sessão', async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://session-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  const getUser = t.mock.method(AuthClient.prototype, 'getUser', async () => {
    throw new TypeError('Network unavailable');
  });
  try {
    const result = await updateSession(new NextRequest('https://odontoia.app/dashboard'));
    assert.equal(getUser.mock.callCount(), 1);
    assert.equal(result.health, 'technical_failure');
    assert.equal(result.session, null);
    assert.equal(result.response.headers.get('set-cookie'), null);
  } finally {
    getUser.mock.restore();
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test('URL inválida é falha técnica e conserva cookies', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  try {
    for (const url of ['not-a-url', 'ftp://session-test.supabase.co']) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      const request = new NextRequest('https://odontoia.app/dashboard', {
        headers: { cookie: 'theme=dark; sb-session-test-auth-token=unchanged' },
      });
      const result = await updateSession(request);
      assert.equal(result.health, 'technical_failure');
      assert.equal(result.session, null);
      assert.equal(result.response.headers.get('set-cookie'), null);
    }
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});

test('sessão ilegível é removida sem apagar cookies de outros projetos ou preferências', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://session-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
  const key = 'sb-session-test-auth-token';
  try {
    for (const cookies of [
      [{ name: key, value: 'base64-invalid-session' }],
      createChunks(key, 'base64-' + stringToBase64URL('{invalid json'), 8),
    ]) {
      const request = new NextRequest('https://odontoia.app/dashboard', {
        headers: { cookie: [...cookies, { name: 'theme', value: 'dark' }, { name: 'sb-other-auth-token', value: 'untouched' }].map(c => `${c.name}=${c.value}`).join('; ') },
      });
      const { response, session } = await updateSession(request);
      assert.equal(session, null);
      for (const cookie of cookies) assert.equal(response.cookies.get(cookie.name)?.maxAge, 0);
      assert.equal(response.cookies.get('theme'), undefined);
      assert.equal(response.cookies.get('sb-other-auth-token'), undefined);
      const forwarded = response.headers.get('x-middleware-request-cookie') ?? '';
      assert.ok(forwarded.includes('theme=dark'));
      assert.ok(forwarded.includes('sb-other-auth-token=untouched'));
      assert.ok(!forwarded.includes(key));
    }
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
