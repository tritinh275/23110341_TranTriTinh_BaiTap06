require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");

const { connectMongo } = require("./src/config/mongodb");
const { pageRouter } = require("./src/routes/pages");
const { apiRouter } = require("./src/routes/api");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api", apiRouter);
app.use("/", pageRouter);

app.use((error, req, res, next) => {
  console.error(error);
  if (req.path.startsWith("/api")) {
    return res.status(500).json({ message: "Lỗi hệ thống, vui lòng thử lại sau" });
  }
  return res.status(500).render("not-found");
});

app.use((req, res) => {
  res.status(404).render("not-found");
});

async function bootstrap() {
  const mongoUri = await connectMongo();
  app.listen(PORT, () => {
    console.log(`MongoDB connected: ${mongoUri}`);
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Không thể kết nối MongoDB:", error.message);
  process.exit(1);
});
