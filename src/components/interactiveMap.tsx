'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';

const projects = [
    { lat: 25.54, lng: -103.40, name: 'Proyecto Industrial Torreón', description: 'Nave de 15,000 m²' },
    { lat: 25.68, lng: -100.31, name: 'Centro Comercial Monterrey', description: 'Cimentación y estructura' },
    { lat: 19.43, lng: -99.13, name: 'Infraestructura CDMX', description: 'Obra civil' },
    { lat: 29.07, lng: -110.96, name: 'Planta de Producción Hermosillo', description: 'Proyecto llave en mano' },
];


const customIcon = new Icon({
    iconUrl: '/location-pin.png',
    iconSize: [38, 38],
});

export default function InteractiveMap() {
    return (
        <MapContainer
            center={[23.63, -102.55]}
            zoom={5}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%', borderRadius: '8px' }}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {projects.map((project, index) => (
                <Marker key={index} position={[project.lat, project.lng]} icon={customIcon}>
                    <Popup>
                        <strong>{project.name}</strong><br />{project.description}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}