const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:4000';

const defaultOptions = {
  credentials: 'include', // send and receive cookies
  headers: {
    'Content-Type': 'application/json',
  },
};

export const createBackendSession = async (email, role) => {
  const res = await fetch(`${BACKEND_BASE_URL}/api/session/login`, {
    method: 'POST',
    ...defaultOptions,
    body: JSON.stringify({ email, role }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    // Check for rate limiting (429 status code)
    if (res.status === 429) {
      const message = data.message || 'Too many login attempts. Please try again later.';
      const error = new Error(message);
      error.code = 'RATE_LIMIT_EXCEEDED';
      error.status = 429;
      throw error;
    }
    
    const message =
      data.message || 'Failed to create backend session. Please try again.';
    throw new Error(message);
  }

  return data.user;
};

export const destroyBackendSession = async () => {
  try {
    await fetch(`${BACKEND_BASE_URL}/api/session/logout`, {
      method: 'POST',
      ...defaultOptions,
    });
  } catch (err) {
    // Backend logout failure should not block frontend logout
    console.error('Backend logout failed (ignored):', err);
  }
};

export const getBackendSession = async () => {
  const res = await fetch(`${BACKEND_BASE_URL}/api/session/me`, {
    method: 'GET',
    credentials: 'include',
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json().catch(() => null);
  if (!data || !data.ok) return null;
  return data.user;
};


