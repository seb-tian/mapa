import { Component } from '@angular/core';
import * as L from 'leaflet';
import { Geolocation } from '@capacitor/geolocation';

interface PuntoRuta {
  lat: number;
  lng: number;
  timestamp: number;
}

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  
  private mapa: L.Map | undefined;
  private marcadores: L.Marker[] = [];
  private polyline: L.Polyline | undefined;
  private puntos: PuntoRuta[] = [];
  private ubicacionActual: { lat: number; lng: number } | null = null;

  constructor() {
    this.cargarPuntosDeStorage();
  }

  ionViewDidEnter() {
    this.inicializarMapa();
    this.actualizarContador();
  }

  inicializarMapa() {
    const latDefault = 4.6097;
    const lngDefault = -74.0817;
    
    this.mapa = L.map('mapId').setView([latDefault, lngDefault], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.mapa);
    
    if (this.puntos.length > 0) {
      const primerPunto = this.puntos[0];
      this.mapa.setView([primerPunto.lat, primerPunto.lng], 14);
    }
    
    console.log('Mapa inicializado');
    this.actualizarEstado('Mapa listo. Comienza a recolectar puntos');
  }

  async obtenerPunto() {
    const btn = document.getElementById('btnPunto') as any;
    
    try {
      if (btn) btn.disabled = true;
      this.actualizarEstado('Obteniendo ubicación GPS...');
      
      const permisos = await Geolocation.checkPermissions();
      if (permisos.location !== 'granted') {
        const solicitud = await Geolocation.requestPermissions();
        if (solicitud.location !== 'granted') {
          alert('Necesitas aceptar los permisos de ubicación');
          this.actualizarEstado('Permiso denegado');
          if (btn) btn.disabled = false;
          return;
        }
      }
      
      const coordenadas = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      });
      
      const lat = coordenadas.coords.latitude;
      const lng = coordenadas.coords.longitude;
      const precision = coordenadas.coords.accuracy;
      
      console.log('Punto obtenido:', lat, lng);
      
      const nuevoPunto: PuntoRuta = {
        lat: lat,
        lng: lng,
        timestamp: Date.now()
      };
      
      this.puntos.push(nuevoPunto);
      this.guardarPuntosEnStorage();
      
      this.mostrarCoordenadasActuales(lat, lng, precision);
      
      this.actualizarContador();
      
      this.agregarMarcador(lat, lng, this.puntos.length);
      
      this.mapa?.setView([lat, lng], 16);
      
      this.actualizarEstado(`Punto ${this.puntos.length} guardado! Precisión: ${precision.toFixed(0)}m`);
      
      this.mostrarToastTemporal(`✅ Punto ${this.puntos.length} guardado`);
      
    } catch (error: any) {
      console.error('Error:', error);
      let mensaje = 'Error al obtener ubicación. ';
      if (error.message?.includes('denied')) {
        mensaje = 'Permiso denegado. Actívalo en Configuración';
      } else if (error.message?.includes('timeout')) {
        mensaje = 'El GPS no responde. Actívalo y sal al aire libre';
      } else {
        mensaje = 'No se pudo obtener ubicación. Verifica el GPS';
      }
      this.actualizarEstado('Error');
      alert(mensaje);
      
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  
  agregarMarcador(lat: number, lng: number, numero: number) {

    const icono = L.divIcon({
      html: `
        <div style="
          background-color: #3880ff;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          color: white;
        ">
          ${numero}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
      className: 'custom-marker'
    });
    
    const marker = L.marker([lat, lng], { icon: icono })
      .addTo(this.mapa!)
      .bindPopup(`
        <b>📍 Punto ${numero}</b><br>
        Lat: ${lat.toFixed(6)}<br>
        Lng: ${lng.toFixed(6)}
      `);
    
    this.marcadores.push(marker);
  }


  dibujarRuta() {
    if (this.puntos.length < 2) {
      alert(`Necesitas al menos 2 puntos para trazar una ruta. Actualmente tienes ${this.puntos.length} puntos.`);
      return;
    }
    
    this.actualizarEstado(`Trazando ruta con ${this.puntos.length} puntos...`);
    
  
    if (this.polyline) {
      this.mapa?.removeLayer(this.polyline);
    }
    
    
    const coordenadasRuta: [number, number][] = this.puntos.map(p => [p.lat, p.lng]);
    
  
    this.polyline = L.polyline(coordenadasRuta, {
      color: '#ff4444',
      weight: 4,
      opacity: 0.8,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(this.mapa!);
    
    const bounds = L.latLngBounds(coordenadasRuta);
    this.mapa?.fitBounds(bounds, { padding: [30, 30] });
    
    this.mostrarInfoRuta();
    
    this.actualizarEstado(`✅ Ruta trazada con ${this.puntos.length} puntos!`);
    
    this.mostrarToastTemporal(`🎯 Ruta trazada con ${this.puntos.length} puntos`);
  }

  mostrarInfoRuta() {
    let distanciaTotal = 0;
    for (let i = 1; i < this.puntos.length; i++) {
      distanciaTotal += this.calcularDistancia(
        this.puntos[i-1].lat, this.puntos[i-1].lng,
        this.puntos[i].lat, this.puntos[i].lng
      );
    }
    
    console.log(`Distancia total aproximada: ${distanciaTotal.toFixed(2)} metros`);
    
    const ultimoPunto = this.puntos[this.puntos.length - 1];
    const popupInfo = L.popup()
      .setLatLng([ultimoPunto.lat, ultimoPunto.lng])
      .setContent(`
        <b>🏁 Fin de la ruta</b><br>
        Puntos: ${this.puntos.length}<br>
        Distancia: ${distanciaTotal.toFixed(0)} metros
      `)
      .openOn(this.mapa!);
  }

  calcularDistancia(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; 
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRad(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  mostrarCoordenadasActuales(lat: number, lng: number, precision: number) {
    const panel = document.getElementById('panelCoordenadas');
    if (panel) panel.style.display = 'block';
    
    const latEl = document.getElementById('latitudValor');
    const lngEl = document.getElementById('longitudValor');
    const precisionEl = document.getElementById('precisionValor');
    
    if (latEl) latEl.innerHTML = lat.toFixed(6);
    if (lngEl) lngEl.innerHTML = lng.toFixed(6);
    if (precisionEl) precisionEl.innerHTML = precision.toFixed(1);
    
    setTimeout(() => {
      if (panel) panel.style.display = 'none';
    }, 3000);
  }

  actualizarContador() {
    const contador = document.getElementById('contadorValor');
    if (contador) {
      contador.innerHTML = this.puntos.length.toString();
    }
  }
  actualizarEstado(mensaje: string) {
    const estadoDiv = document.getElementById('estadoGPS');
    if (estadoDiv) {
      estadoDiv.innerHTML = `<ion-icon name="location-outline"></ion-icon><span>${mensaje}</span>`;
    }
  }

  mostrarToastTemporal(mensaje: string) {
    const toast = document.createElement('ion-toast');
    toast.message = mensaje;
    toast.duration = 1500;
    toast.position = 'bottom';
    document.body.appendChild(toast);
    toast.present();
    
    setTimeout(() => {
      toast.remove();
    }, 2000);
  }

  guardarPuntosEnStorage() {
    try {
      localStorage.setItem('puntosRuta', JSON.stringify(this.puntos));
      console.log('Puntos guardados en localStorage:', this.puntos.length);
    } catch (error) {
      console.error('Error al guardar:', error);
    }
  }
  cargarPuntosDeStorage() {
    try {
      const puntosGuardados = localStorage.getItem('puntosRuta');
      if (puntosGuardados) {
        this.puntos = JSON.parse(puntosGuardados);
        console.log('Puntos cargados de localStorage:', this.puntos.length);
        
        setTimeout(() => {
          if (this.mapa && this.puntos.length > 0) {
            this.puntos.forEach((punto, index) => {
              this.agregarMarcador(punto.lat, punto.lng, index + 1);
            });
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error al cargar puntos:', error);
      this.puntos = [];
    }
  }

  limpiarPuntos() {
    if (this.puntos.length === 0) {
      alert('No hay puntos para limpiar');
      return;
    }
    
    const confirmar = confirm(`¿Seguro que quieres eliminar los ${this.puntos.length} puntos guardados?`);
    if (confirmar) {
    
      this.marcadores.forEach(marker => {
        this.mapa?.removeLayer(marker);
      });
      this.marcadores = [];
      
      if (this.polyline) {
        this.mapa?.removeLayer(this.polyline);
        this.polyline = undefined;
      }
      
      this.puntos = [];
      
      localStorage.removeItem('puntosRuta');
      
      this.actualizarContador();
      
      this.actualizarEstado('Todos los puntos han sido eliminados');
      
      this.mapa?.setView([4.6097, -74.0817], 13);
      
      alert('✅ Todos los puntos han sido eliminados');
    }
  }
}