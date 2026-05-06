// Vercel serverless: metas estáticas (espelha defaults do server local).
// Mantém /api/metas funcional em produção sem precisar de DB.

export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    meta12p: Number(process.env.META_12P) || 3000000,
    metaConsultoria: Number(process.env.META_CONSULTORIA) || 1500000,
    metaLtda: Number(process.env.META_LTDA) || 1500000,
  });
}
