import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class VerifyEntraAdapterDto {
  @ApiProperty({
    description: "OIDC JWT (id_token or access_token) from Microsoft Entra",
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiPropertyOptional({
    description:
      "Optional wallet address to compare against Entra wallet claim",
  })
  @IsOptional()
  @IsString()
  requestedWalletAddress?: string;
}
