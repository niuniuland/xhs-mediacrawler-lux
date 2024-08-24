export async function retry(fn, retries = 5, delay = 5000) {
    let lastError = null;

    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (i < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError ?? new Error("Retries exhausted with unknown error");
}