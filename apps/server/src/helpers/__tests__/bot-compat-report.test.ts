import { describe, expect, test } from 'bun:test';
import { describeRestCall } from '../bot-compat-report';

describe('describeRestCall', () => {
  test('folds ids, emoji and interaction tokens into placeholders', () => {
    expect(describeRestCall('GET', '/guilds/123/members/456')).toBe(
      'GET /guilds/{id}/members/{id}'
    );
    expect(
      describeRestCall(
        'PUT',
        '/channels/1/messages/2/reactions/%F0%9F%91%8D/@me'
      )
    ).toBe('PUT /channels/{id}/messages/{id}/reactions/{emoji}/@me');
    expect(describeRestCall('POST', `/webhooks/1/${'a'.repeat(64)}`)).toBe(
      'POST /webhooks/{id}/{token}'
    );
    expect(describeRestCall('GET', '/users/@me/guilds/')).toBe(
      'GET /users/@me/guilds'
    );
  });
});
