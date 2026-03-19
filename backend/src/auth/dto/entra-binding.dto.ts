import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class RevokeEntraBindingDto {
  @ApiProperty({ description: "Entra subject/oid to revoke" })
  @IsString()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({ description: "Wallet bound to subject" })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiPropertyOptional({ description: "Administrative revocation reason" })
  @IsOptional()
  @IsString()
  reason?: string;
}
