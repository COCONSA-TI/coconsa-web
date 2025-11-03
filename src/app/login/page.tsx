import Image from 'next/image';

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
            <form className="bg-white p-8 rounded shadow-md w-full max-w-sm flex flex-col gap-4">
                <div className="mb-8 flex justify-center">
                    <Image
                        src="/logo-coconsa.png"
                        alt="Company Logo"
                        width={120}
                        height={120}
                        priority
                    />
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="you@example.com"
                    />
                </div>
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="********"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-semibold"
                >
                    Login
                </button>
            </form>
        </div>
    );
}