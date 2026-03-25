import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { SixService } from "./six/six.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  app.enableShutdownHooks();

  // ── Global Prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix("api/v1", { exclude: ["/"] });

  // ── CORS ──────────────────────────────────────────────────────────────
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());
  app.enableCors({ origin: allowedOrigins, credentials: true });

  // ── Validation ─────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties
      forbidNonWhitelisted: true,
      transform: true, // auto-transform payloads to DTO classes
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Swagger ────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("VaultOX API")
      .setDescription(
        "Institutional stablecoin treasury OS — KYC/AML/Travel Rule compliant",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .addTag("auth", "Wallet-based authentication")
      .addTag("compliance", "KYC credentials and AML screening")
      .addTag("vaults", "Yield strategies and positions")
      .addTag("settlements", "Cross-border USDC settlements")
      .addTag("reports", "Compliance reports and audit trail")
      .addTag("settings", "Institution configuration")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/v1/docs", app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log("Swagger docs available at /api/v1/docs");
  }

  // ── SSE ────────────────────────────────────────────────────────────────
  // Allow SSE connections to stay open longer than the default timeout
  const httpServer = app.getHttpServer();
  httpServer.keepAliveTimeout = 90_000;
  httpServer.headersTimeout = 91_000;

  const sixService = app.get(SixService);
  const sixReadiness = sixService.getReadinessStatus();
  if (sixReadiness.ready) {
    logger.log(`SIX mTLS ready: ${sixReadiness.reason}`);
  } else {
    logger.warn(`SIX mTLS not ready: ${sixReadiness.reason}`);
  }

  const port = parseInt(process.env.PORT ?? "3001", 10);
  await app.listen(port);
  logger.log(`VaultOX API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
