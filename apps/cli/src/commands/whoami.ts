import { MeResponseSchema } from '@nibras/contracts';
import { apiRequest } from '@nibras/core';
import { printBox } from '../ui/box';

export async function commandWhoami(plain: boolean): Promise<void> {
  const response = MeResponseSchema.parse(await apiRequest('/v1/me'));

  printBox(
    `Signed in as ${response.user.username}`,
    [
      `User:    ${response.user.username}`,
      `GitHub:  ${response.user.githubLogin}`,
      `API:     ${response.apiBaseUrl}`,
    ],
    'info',
    plain
  );
}
