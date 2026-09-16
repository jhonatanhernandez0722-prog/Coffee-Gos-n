const productionApiUrl = "https://backend-lemon-five-80.vercel.app/api/v1";
const developmentApiUrl = "http://localhost:8001/api/v1";

export const apiUrl = process.env.NEXT_PUBLIC_API_URL || (
  process.env.NODE_ENV === "production" ? productionApiUrl : developmentApiUrl
);