async function getAccessToken() {
    const credentials = Buffer.from(
        `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const response = await fetch(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
            headers: {
                Authorization: `Basic ${credentials}`
            }
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.errorMessage || "Failed to get access token");
    }

    return data.access_token;
}
function getDarajaTimestamp() {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());

    const values = Object.fromEntries(
        parts.map(part => [part.type, part.value])
    );

    return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`;
}
async function initiateSTKPush(phone, amount, orderId) {
    const accessToken = await getAccessToken();

    const timestamp = getDarajaTimestamp();

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    const password = Buffer.from(
        `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    const formattedPhone = phone.replace(/^\+/, "").replace(/^0/, "254");

    const response = await fetch(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: amount,
                PartyA: formattedPhone,
                PartyB: shortcode,
                PhoneNumber: formattedPhone,
                CallBackURL: process.env.MPESA_CALLBACK_URL,
                AccountReference: `DAPFARM`,
                TransactionDesc: "DapFarm"
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.errorMessage || "STK Push failed");
    }

    return data;
}
async function querySTKPush(checkoutRequestId) {
    const accessToken = await getAccessToken();

    const timestamp = getDarajaTimestamp();

    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    const password = Buffer.from(
        `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    const response = await fetch(
        "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                BusinessShortCode: shortcode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestId
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.log("M-Pesa query response:", data);
        throw new Error(data.errorMessage || "Payment verification failed");
    }

    return data;
}
module.exports = {
    getAccessToken,
    initiateSTKPush,
    querySTKPush
};