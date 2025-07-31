import { Logger } from '@n8n/backend-common';
import { RoleRepository, Scope, ScopeRepository } from '@n8n/db';
import { Service } from '@n8n/di';
import { ALL_SCOPES, ALL_ROLES, scopeInformation } from '@n8n/permissions';

@Service()
export class AuthRolesService {
	constructor(
		private readonly logger: Logger,
		private readonly scopeRepository: ScopeRepository,
		private readonly roleRepository: RoleRepository,
	) {}

	private async syncScopes() {
		const availableScopes = await this.scopeRepository.find({
			select: {
				slug: true,
				displayName: true,
				description: true,
			},
		});

		const scopesToUpdate = ALL_SCOPES.map((slug) => {
			const info = scopeInformation[slug] ?? {
				displayName: slug,
				description: null,
			};

			const existingScope = availableScopes.find((scope) => scope.slug === slug);
			if (!existingScope) {
				const newScope = new Scope();
				newScope.slug = slug;
				newScope.displayName = info.displayName;
				newScope.description = info.description ?? null;
				return newScope;
			}

			const needsUpdate =
				existingScope.displayName !== info.displayName ||
				existingScope.description !== info.description;

			if (needsUpdate) {
				existingScope.displayName = info.displayName;
				existingScope.description = info.description ?? null;
				return existingScope;
			}
			return null;
		}).filter((scope) => scope !== null);

		if (scopesToUpdate.length > 0) {
			this.logger.info(`Updating ${scopesToUpdate.length} scopes...`);
			await this.scopeRepository.save(scopesToUpdate);
			this.logger.info('Scopes updated successfully.');
		} else {
			this.logger.info('No scopes to update.');
		}
	}

	private async syncRoles() {
		const existingRoles = await this.roleRepository.find({
			select: {
				slug: true,
				displayName: true,
				description: true,
				systemRole: true,
				roleType: true,
			},
			where: {
				systemRole: true,
			},
		});

		const allScopes = await this.scopeRepository.find({
			select: {
				slug: true,
			},
		});

		for (const roleNamespace of Object.keys(ALL_ROLES) as Array<keyof typeof ALL_ROLES>) {
			const rolesToUpdate = ALL_ROLES[roleNamespace]
				.map((role) => {
					const existingRole = existingRoles.find((r) => r.slug === role.role);

					if (!existingRole) {
						const newRole = this.roleRepository.create({
							slug: role.role,
							displayName: role.name,
							description: role.description ?? null,
							roleType: roleNamespace,
							systemRole: true,
							scopes: allScopes.filter((scope) => role.scopes.includes(scope.slug)),
						});
						return newRole;
					}

					const needsUpdate =
						existingRole.displayName !== role.name ||
						existingRole.description !== role.description ||
						existingRole.roleType !== roleNamespace ||
						existingRole.scopes.some((scope) => !role.scopes.includes(scope.slug)) || // DB roles has scope that it should not have
						role.scopes.some((scope) => !existingRole.scopes.some((s) => s.slug === scope)); // A role has scope that is not in DB

					if (needsUpdate) {
						existingRole.displayName = role.name;
						existingRole.description = role.description ?? null;
						existingRole.roleType = roleNamespace;
						existingRole.scopes = allScopes.filter((scope) => role.scopes.includes(scope.slug));
						return existingRole;
					}

					return null;
				})
				.filter((role) => role !== null);
			if (rolesToUpdate.length > 0) {
				this.logger.info(`Updating ${rolesToUpdate.length} ${roleNamespace} roles...`);
				await this.roleRepository.save(rolesToUpdate);
				this.logger.info(`${roleNamespace} roles updated successfully.`);
			} else {
				this.logger.info(`No ${roleNamespace} roles to update.`);
			}
		}
	}

	async init() {
		this.logger.info('Initializing AuthRolesService...');
		await this.syncScopes();
		await this.syncRoles();
		this.logger.info('AuthRolesService initialized successfully.');
	}
}
