/* eslint-disable @typescript-eslint/no-explicit-any */
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export async function requireStaff(service: any, req: Request) {
  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) throw new HttpError(401, 'Sign in is required')
  const { data, error } = await service.auth.getUser(authorization.slice(7))
  if (error || !data?.user) throw new HttpError(401, 'Your session is no longer valid')
  const role = await service.from('user_roles').select('role').eq('user_id', data.user.id).in('role', ['admin', 'staff']).limit(1).maybeSingle()
  if (role.error || !role.data) throw new HttpError(403, 'Admin or staff access is required')
  return data.user
}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
