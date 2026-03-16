import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PeriodDto {
  @ApiProperty({ example: "2026-01-01" })
  @IsDateString()
  from: string;

  @ApiProperty({ example: "2026-03-31" })
  @IsDateString()
  to: string;
}

export class GenerateReportDto {
  @ApiProperty({ enum: ["FINMA", "MiCA", "MAS", "Custom"] })
  @IsIn(["FINMA", "MiCA", "MAS", "Custom"])
  framework: string;

  @ApiPropertyOptional({ enum: ["pdf", "csv", "json"], default: "json" })
  @IsOptional()
  @IsIn(["pdf", "csv", "json"])
  format?: string;

  @ApiProperty({ type: PeriodDto })
  @ValidateNested()
  @Type(() => PeriodDto)
  period: PeriodDto;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeSettlements?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includePositions?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeAuditLog?: boolean;
}
