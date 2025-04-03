// lokal.ts
import c from 'picocolors';

const ServerMinVersion = '0.6.0';

type TunnelType = 'HTTP' | 'TCP' | 'UDP';

interface TunnelOptions {
	basic_auth?: string[];
	cidr_allow?: string[];
	cidr_deny?: string[];
	request_header_add?: string[];
	request_header_remove?: string[];
	response_header_add?: string[];
	response_header_remove?: string[];
	header_key?: string[];
}

interface TunnelData {
	id?: string;
	name: string;
	tunnel_type: TunnelType;
	local_address: string;
	server_id?: string;
	address_tunnel?: string;
	address_tunnel_port?: number;
	address_public?: string;
	address_mdns?: string;
	inspect: boolean;
	options: TunnelOptions;
}

class Lokal {
	private baseURL: string;
	private basicAuth: { username: string; password: string } | null;
	private token: string | null;
	private debug: boolean;
	private skip_tls: boolean;

	constructor(baseURL: string = 'http://127.0.0.1:6174') {
		this.baseURL = baseURL;
		this.basicAuth = null;
		this.token = null;
		this.debug = false;
		this.skip_tls = false;
	}

	setBaseURL(url: string): Lokal {
		if (url.endsWith('/')) {
			url = url.slice(0, -1);
		}
		this.baseURL = url;
		this.logDebug('Base URL set to:', url);
		return this;
	}

	setBasicAuth(username: string, password: string): Lokal {
		this.basicAuth = { username, password };
		this.logDebug('Basic auth set');
		return this;
	}

	skipTLSVerify(): Lokal {
		try {
			process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
			console.warn(
				'it is recommended to use env NODE_EXTRA_CA_CERTS=cert.crt,cert2.pem instead of skip TLS verify'
			);
		} catch {
			console.warn('process.env not available, skipping...');
		}
		return this;
	}

	setAPIToken(token: string): Lokal {
		this.token = token;
		this.logDebug('API token set');
		return this;
	}

	debugMode(enable: boolean): Lokal {
		this.debug = enable;
		this.logDebug(`Debug mode ${enable ? 'enabled' : 'disabled'}`);
		return this;
	}

	logDebug(...args: any[]): void {
		if (this.debug) {
			console.log(c.yellow('[DEBUG]'), ...args);
		}
	}

	async request(endpoint: string, method: string = 'GET', body: any = null): Promise<any> {
		const headers: HeadersInit = {
			'User-Agent': 'Lokal TS - github.com/lokal-so/lokal-ts',
			'Content-Type': 'application/json'
		};

		if (this.token) {
			headers['X-Auth-Token'] = this.token;
		}

		const options: RequestInit = {
			method,
			headers
		};

		if (this.basicAuth) {
			const auth = btoa(`${this.basicAuth.username}:${this.basicAuth.password}`);
			headers['Authorization'] = `Basic ${auth}`;
		}

		if (body) {
			options.body = JSON.stringify(body);
		}

		this.logDebug('Request:', { endpoint, method, headers, body });

		let response;
		try {
			response = await fetch(`${this.baseURL}${endpoint}`, options);
		} catch (error: unknown) {
			if (error instanceof Error) {
				console.error(
					'No Lokal client running, you may need to install Lokal Client, download at https://lokal.so/download',
					error.message
				);
			}
			this.logDebug('Request failed:', error);
			return;
		}

		const serverVersion = response.headers.get('Lokal-Server-Version');
		this.logDebug('Server version:', serverVersion);

		if (!serverVersion || !this.isValidVersion(serverVersion)) {
			throw new Error('Your local client might be outdated, please update');
		}

		const data = await response.json();
		this.logDebug('Response:', data);

		return data;
	}

	private isValidVersion(version: string): boolean {
		const [major, minor, patch] = version.split('.').map(Number);
		const [minMajor, minMinor, minPatch] = ServerMinVersion.split('.').map(Number);

		if (major > minMajor) return true;
		if (major < minMajor) return false;
		if (minor > minMinor) return true;
		if (minor < minMinor) return false;
		return patch >= minPatch;
	}

	newTunnel(): Tunnel {
		return new Tunnel(this);
	}
}

class Tunnel implements TunnelData {
	private lokal: Lokal;

	id?: string;
	name: string = '';
	tunnel_type: TunnelType = 'HTTP';
	local_address: string = '';
	server_id?: string;
	address_tunnel?: string;
	address_tunnel_port?: number;
	address_public?: string;
	address_mdns?: string;
	inspect: boolean = false;
	options: TunnelOptions = {};

	private ignoreDuplicateFlag: boolean = false;
	private startupBannerFlag: boolean = false;

	constructor(lokal: Lokal) {
		this.lokal = lokal;
	}

	setLocalAddress(localAddress: string): Tunnel {
		this.local_address = localAddress;
		return this;
	}

	setTunnelType(tunnelType: TunnelType): Tunnel {
		this.tunnel_type = tunnelType;
		return this;
	}

	setInspection(inspect: boolean): Tunnel {
		this.inspect = inspect;
		return this;
	}

	setLANAddress(lanAddress: string): Tunnel {
		if (lanAddress) {
			this.address_mdns = lanAddress.replace(/\.local$/, '');
		} else {
			this.address_mdns = '';
		}
		return this;
	}

	setPublicAddress(publicAddress: string): Tunnel {
		this.address_public = publicAddress || '';
		return this;
	}

	setName(name: string): Tunnel {
		this.name = name || '';
		return this;
	}

	ignoreDuplicate(): Tunnel {
		this.ignoreDuplicateFlag = true;
		return this;
	}

	showStartupBanner(): Tunnel {
		this.startupBannerFlag = true;
		return this;
	}

	async create(): Promise<Tunnel> {
		if (!this.address_mdns && !this.address_public) {
			throw new Error('Please enable either LAN address or random/custom public URL');
		}

		const response = await this.lokal.request('/api/tunnel/start', 'POST', this);
		if (response.data.length === 0) {
			throw new Error(response.message || 'Tunnel creation failing');
		}

		this.lokal.logDebug('Duplicate flag', this.ignoreDuplicateFlag);
		this.lokal.logDebug('API response', response.message);

		if (!response.success) {
			if (this.ignoreDuplicateFlag && response.message.endsWith('address is already being used')) {
				this.lokal.logDebug('running ignore duplicate');
				this.address_public = response.data[0].address_public;
				this.address_mdns = response.data[0].address_mdns;
				this.id = response.data[0].id;

				if (this.startupBannerFlag) {
					this.showBanner();
				}
				return this;
			}
			throw new Error(response.message || 'Tunnel creation failing');
		}

		const tunnel = response.data[0];
		this.address_public = tunnel.address_public;
		this.address_mdns = tunnel.address_mdns;
		this.id = tunnel.id;

		if (this.startupBannerFlag) {
			this.showBanner();
		}

		return this;
	}

	async getLANAddress(): Promise<string> {
		if (!this.address_mdns) {
			throw new Error('LAN address is not being set');
		}

		return this.address_mdns.endsWith('.local') ? this.address_mdns : `${this.address_mdns}.local`;
	}

	async getPublicAddress(): Promise<string> {
		if (!this.address_public) {
			throw new Error('Public address is not requested by client');
		}

		if (this.tunnel_type !== 'HTTP' && !this.address_public.includes(':')) {
			await this.updatePublicURLPort();
			throw new Error(
				'Tunnel is using a random port, but it has not been assigned yet. Please try again later'
			);
		}

		return this.address_public;
	}

	private async updatePublicURLPort(): Promise<void> {
		if (!this.id) {
			throw new Error('Tunnel ID is not set');
		}

		const response = await this.lokal.request(`/api/tunnel/info/${this.id}`);

		if (!response.success || response.data.length === 0) {
			throw new Error('Could not get tunnel info');
		}

		const tunnel = response.data[0];
		if (!tunnel.address_public.includes(':')) {
			throw new Error('Could not get assigned port');
		}

		this.address_public = tunnel.address_public;
	}

	private showBanner(): void {
		const banner = `
    __       _         _             
   / /  ___ | | ____ _| |  ___  ___  
  / /  / _ \\| |/ / _  | | / __|/ _ \\ 
 / /__| (_) |   < (_| | |_\\__ \\ (_) |
 \\____/\\___/|_|\\_\\__,_|_(_)___/\\___/ `;

		const colors = [c.magenta, c.blue, c.cyan, c.green, c.red];
		const randomColor = colors[Math.floor(Math.random() * colors.length)];

		console.log(randomColor(banner));
		console.log();
		console.log(c.red('Minimum Lokal Client'), `\t${ServerMinVersion}`);
		if (this.address_public) {
			console.log(c.cyan('Public Address'), `\t\thttps://${this.address_public}`);
		}
		if (this.address_mdns) {
			console.log(c.green('LAN Address'), `\t\thttps://${this.address_mdns}`);
		}
		console.log();
	}
}

export { Lokal, Tunnel, TunnelType, TunnelOptions, TunnelData };
