                    import React, { useState, ChangeEvent, FormEvent } from "react";

                    interface ContactFormProps {
                        onSubmit?: (data: ContactFormData) => void;
                    }

                    interface ContactFormData {
                        name: string;
                        email: string;
                        phone: string;
                        message: string;
                    }

                    const ContactForm: React.FC<ContactFormProps> = ({ onSubmit }) => {
                        const [formData, setFormData] = useState<ContactFormData>({
                            name: "",
                            email: "",
                            phone: "",
                            message: "",
                        });

                        const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                            const { name, value } = e.target;
                            setFormData((prev) => ({ ...prev, [name]: value }));
                        };

                        const handleSubmit = (e: FormEvent) => {
                            e.preventDefault();
                            if (onSubmit) {
                                onSubmit(formData);
                            }
                            // Aquí puedes agregar lógica adicional, como enviar el formulario a una API
                        };

                        return (
                            <div className="bg-white p-8 rounded-lg shadow-lg">
                                <h3 className="text-2xl font-semibold text-gray-800 mb-6">Envíanos un Mensaje</h3>
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                        <input
                                            type="text"
                                            name="name"
                                            id="name"
                                            required
                                            value={formData.name}
                                            onChange={handleChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                                        <input
                                            type="email"
                                            name="email"
                                            id="email"
                                            required
                                            value={formData.email}
                                            onChange={handleChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            id="phone"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="message" className="block text-sm font-medium text-gray-700">Mensaje</label>
                                        <textarea
                                            name="message"
                                            id="message"
                                            rows={4}
                                            required
                                            value={formData.message}
                                            onChange={handleChange}
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        ></textarea>
                                    </div>
                                    <div>
                                        <button
                                            type="submit"
                                            className="w-full bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors duration-300"
                                        >
                                            Enviar Mensaje
                                        </button>
                                    </div>
                                </form>
                            </div>
                        );
                    };

                    export default ContactForm;