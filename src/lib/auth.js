import jwt from 'jsonwebtoken'

function secret() {
  return process.env.JWT_SECRET
}

export function signToken() {
  return jwt.sign({ admin: true }, secret(), { expiresIn: '8h' })
}

export function verifyToken(token) {
  try {
    jwt.verify(token, secret())
    return true
  } catch {
    return false
  }
}

export function requireAdmin(req, res) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  if (!verifyToken(auth.slice(7))) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}
