import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifySignatureDto {
  @ApiProperty({ example: 'GjF9...xyz' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ example: 'base58encodedSignature' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({ example: 'VaultOX-auth-1714500000000' })
  @IsString()
  @IsNotEmpty()
  nonce: string;
}
