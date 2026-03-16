import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { GenerateReportDto } from "./dto/generate-report.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { WalletAddress } from "../common/decorators/wallet.decorator";

@ApiTags("reports")
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "List all reports for the authenticated institution",
  })
  getReports(@WalletAddress() wallet: string) {
    return this.reportsService.getReports(wallet);
  }

  @Post("generate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Generate a compliance report. Compiles live DB data (settlements, audit trail, AML screenings) and uploads the file to Cloudinary. Returns a real download URL.",
  })
  generateReport(
    @WalletAddress() wallet: string,
    @Body(ValidationPipe) dto: GenerateReportDto,
  ) {
    return this.reportsService.generateReport(wallet, dto);
  }

  @Get("compliance/summary")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Compliance metrics summary for current month" })
  getComplianceSummary(@WalletAddress() wallet: string) {
    return this.reportsService.getComplianceSummary(wallet);
  }
}
