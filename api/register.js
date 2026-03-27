export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { lineUserId, name, email } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({ message: "名前とメールアドレスは必須です。" });
    }

    const shop = process.env.SHOPIFY_SHOP;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-01";

    if (!shop || !clientId || !clientSecret) {
      return res.status(500).json({ message: "Shopify環境変数が不足しています。" });
    }

    const tokenResponse = await fetch(
      `https://${shop}.myshopify.com/admin/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials"
        })
      }
    );

    const tokenText = await tokenResponse.text();
    let tokenData;

    try {
      tokenData = JSON.parse(tokenText);
    } catch (e) {
      console.error("Token raw response:", tokenText);
      return res.status(500).json({
        message: "Shopifyトークン取得時にHTMLまたは不正な文字列が返りました。"
      });
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("Token error:", tokenData);
      return res.status(500).json({
        message: "Shopifyアクセストークン取得に失敗しました。",
        error: tokenData
      });
    }

    const accessToken = tokenData.access_token;

    const customerPayload = {
      customer: {
        first_name: name,
        email: email,
        note: lineUserId ? `LINE_USER_ID: ${lineUserId}` : "LINE登録経由",
        tags: lineUserId ? `line_registered,line_user_id:${lineUserId}` : "line_registered"
      }
    };

    const customerResponse = await fetch(
      `https://${shop}.myshopify.com/admin/api/${apiVersion}/customers.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken
        },
        body: JSON.stringify(customerPayload)
      }
    );

    const customerText = await customerResponse.text();
    let customerData;

    try {
      customerData = JSON.parse(customerText);
    } catch (e) {
      console.error("Customer raw response:", customerText);
      return res.status(500).json({
        message: "Shopify顧客作成時にHTMLまたは不正な文字列が返りました。"
      });
    }

    if (!customerResponse.ok) {
      console.error("Customer create error:", customerData);
      return res.status(500).json({
        message: "Shopify顧客作成に失敗しました。",
        error: customerData
      });
    }

    return res.status(200).json({
      message: "会員登録が完了しました。",
      customer: customerData.customer
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return res.status(500).json({ message: "サーバーエラーが発生しました。" });
  }
}
