// /api/bookings.js — simple shared storage using Vercel serverless function

let cache = {};

export default async function handler(req, res) {
  const { method, query, body } = req;
  const weekKey = query.weekKey || body?.weekKey;
  if (!weekKey) return res.status(400).json({ error: "Missing weekKey" });

  if (!cache[weekKey]) cache[weekKey] = {};

  if (method === "GET") {
    return res.status(200).json(Object.values(cache[weekKey]));
  }

  if (method === "POST") {
    const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, ...body };
    cache[weekKey][id] = record;
    return res.status(201).json(record);
  }

  if (method === "DELETE") {
    const { id } = query;
    if (id && cache[weekKey][id]) delete cache[weekKey][id];
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  res.status(405).end(`Method ${method} Not Allowed`);
}
