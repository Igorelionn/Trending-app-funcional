/**
 * Verificações de permissão de streaming.
 * A autorização real é feita pelo LiveStreamPermissionProvider que consulta
 * o campo is_admin em user_profiles no banco de dados.
 * Estas funções são mantidas para compatibilidade de interface.
 */

export const canStartLive = (_userEmail: string): boolean => false;

export const shouldShowStartLiveButton = (_userEmail: string | undefined | null): boolean => false;
