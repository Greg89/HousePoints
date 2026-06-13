import { Auth0Client } from "@auth0/nextjs-auth0/server";

let auth0Client: Auth0Client | null = null;

function hasRequiredAuthEnv(): boolean {
	return Boolean(
		process.env.AUTH0_DOMAIN &&
			process.env.AUTH0_CLIENT_ID &&
			process.env.AUTH0_CLIENT_SECRET &&
			process.env.AUTH0_SECRET,
	);
}

export function getAuth0Client(): Auth0Client | null {
	if (!hasRequiredAuthEnv()) {
		return null;
	}

	if (!auth0Client) {
		auth0Client = new Auth0Client();
	}

	return auth0Client;
}
