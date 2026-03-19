export async function sendOpsNotification(payload) {
    const url = process.env.OPS_WEBHOOK_URL || '';
    if (!url) return { skipped: true };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Ops webhook failed with status ${response.status}`);
    }

    return { skipped: false };
}
