// An approval is reusable only for the same target and unchanged evidence while
// the server-issued receipt is still valid. Leave a small margin for transit.
export function canReuseApprovedReview(cached, evidenceKey, targetKey, now = Date.now()) {
  const review = cached?.review;
  const expires = Date.parse(review?.expires_at || "");
  return cached?.key === evidenceKey && cached?.target === targetKey
    && review?.decision === "APPROVE" && !!review.id
    && Number.isFinite(expires) && expires > now + 5000;
}
