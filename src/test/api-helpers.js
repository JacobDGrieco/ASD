export function mockReq(overrides = {}) {
  return {
    method: 'GET',
    query: {},
    body: {},
    headers: {},
    ...overrides,
  }
}

export function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
    end() {
      return this
    },
    setHeader(key, value) {
      this.headers[key] = value
      return this
    },
  }
  return res
}
