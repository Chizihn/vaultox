import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChallengeDto {
  @ApiProperty({ example: 'GjF9...xyz' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}
