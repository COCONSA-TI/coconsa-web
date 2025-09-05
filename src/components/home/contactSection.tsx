'use client';

import { useState } from 'react';

export default function ContactSection() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // TODO: Aquí irá la lógica para enviar el formulario.
        // Usaremos un servicio como Resend o una API Route de Next.js.
        console.log('Datos del formulario:', formData);
        alert('Gracias por tu mensaje. Nos pondremos en contacto contigo pronto.');
        // Limpiar formulario
        setFormData({ name: '', email: '', phone: '', message: '' });
    };

    return (
        <section id="contacto" className="py-16 sm:py-24 bg-gray-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Encabezado */}
                <div className="text-center max-w-3xl mx-auto">
                    <p className="text-blue-600 font-semibold">CONTACTO</p>
                    <h2 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">
                        ¿Listo para Iniciar tu Próximo Proyecto?
                    </h2>
                    <p className="mt-4 text-lg text-gray-600">
                        Nuestro equipo está listo para asesorarte. Contáctanos a través de nuestros canales directos o envíanos un mensaje y te responderemos a la brevedad.
                    </p>
                </div>

                <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Columna de Información y Mapa */}
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-2xl font-semibold text-gray-800">Nuestra Oficina</h3>
                            <p className="flex items-center text-gray-600">
                                <svg className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                                Joaquin Serrano #255, Torreón, Coahuila, México, CP 27019
                            </p>
                            <p className="flex items-center text-gray-600">
                                <svg className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path></svg>
                                871 754 1464
                            </p>
                            <p className="flex items-center text-gray-600">
                                <svg className="w-5 h-5 mr-3 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
                                ventas@coconsa.com.mx
                            </p>
                        </div>
                        {/* Contenedor del Mapa */}
                        <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-lg">
                            {/* PEGA AQUÍ EL CÓDIGO DE TU IFRAME DE GOOGLE MAPS */}
                            <iframe
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3598.4958022914047!2d-103.39807402409923!3d25.58843611574215!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x868fda8d0f5c88ef%3A0x9acd5226be48d443!2sJoaqu%C3%ADn%20Serrano%20255%2C%20Cd%20Industrial%2C%2027019%20Torre%C3%B3n%2C%20Coah.!5e0!3m2!1ses!2smx!4v1757092305317!5m2!1ses!2smx"
                                width="100%"
                                height="100%"
                                style={{ border: 0 }}
                                allowFullScreen={true}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                        </div>
                    </div>

                    {/* Columna del Formulario */}
                    <div className="bg-white p-8 rounded-lg shadow-lg">
                        <h3 className="text-2xl font-semibold text-gray-800 mb-6">Envíanos un Mensaje</h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre Completo</label>
                                <input type="text" name="name" id="name" required value={formData.name} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo Electrónico</label>
                                <input type="email" name="email" id="email" required value={formData.email} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label>
                                <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="message" className="block text-sm font-medium text-gray-700">Mensaje</label>
                                <textarea name="message" id="message" rows={4} required value={formData.message} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"></textarea>
                            </div>
                            <div>
                                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-300">
                                    Enviar Mensaje
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}