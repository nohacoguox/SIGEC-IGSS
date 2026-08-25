# VR Infosys – Segmentación por VLANs e InterVLAN

## Requisitos

- **1 Router principal**, **4 niveles** (4 switches, 1 por nivel).
- Una **VLAN por departamento**.
- **Acceso al resto de VLANs** solo: **Dirección**, **Subdirección**, **Informática** y **Administrativo**. El resto de departamentos no puede acceder a otras VLANs.

*Nota: "Administrativo" no aparece en la lista por niveles; se asume como departamento con acceso total (si no aplica, se puede quitar la VLAN 110 y las reglas asociadas).*

---

## 1. Asignación de VLANs y subredes

| VLAN ID | Departamento        | Subred           | Gateway (.1)    | Acceso a otras VLANs |
|--------:|---------------------|------------------|-----------------|-----------------------|
| 10      | Información Pública | 192.168.10.0/24  | 192.168.10.1    | No                    |
| 20      | Auditoría           | 192.168.20.0/24  | 192.168.20.1    | No                    |
| 30      | Informática         | 192.168.30.0/24  | 192.168.30.1    | **Sí**                |
| 40      | Recursos Humanos    | 192.168.40.0/24  | 192.168.40.1    | No                    |
| 50      | Financiero          | 192.168.50.0/24  | 192.168.50.1    | No                    |
| 60      | Jurídico            | 192.168.60.0/24  | 192.168.60.1    | No                    |
| 70      | Comunicación Social | 192.168.70.0/24  | 192.168.70.1    | No                    |
| 80      | Servicios Generales | 192.168.80.0/24  | 192.168.80.1    | No                    |
| 90      | Dirección           | 192.168.90.0/24  | 192.168.90.1    | **Sí**                |
| 100     | Subdirección        | 192.168.100.0/24 | 192.168.100.1   | **Sí**                |
| 110     | Administrativo      | 192.168.110.0/24 | 192.168.110.1   | **Sí**                |

---

## 2. Topología (resumen)

```
                    [Router]
                        |
                  (trunk)
                        |
              [Switch Nivel 4]  ← Dirección, Subdirección
                  (trunk)
              [Switch Nivel 3]  ← Jurídico, Comunicación, Servicios Generales
                  (trunk)
              [Switch Nivel 2]  ← Informática, RRHH, Financiero
                  (trunk)
              [Switch Nivel 1]  ← Información Pública, Auditoría
```

- Un **switch por nivel**. Enlaces **switch–switch** y **switch–router** en **trunk**.
- Puertos hacia PCs/impresoras en **access** en la VLAN del departamento correspondiente.

---

## 3. Configuración en los switches (por nivel)

En **cada** switch (2960 o similar):

### 3.1 Crear todas las VLANs (en los 4 switches)

```
enable
configure terminal
vlan 10
 name Informacion_Publica
vlan 20
 name Auditoria
vlan 30
 name Informatica
vlan 40
 name Recursos_Humanos
vlan 50
 name Financiero
vlan 60
 name Juridico
vlan 70
 name Comunicacion_Social
vlan 80
 name Servicios_Generales
vlan 90
 name Direccion
vlan 100
 name Subdireccion
vlan 110
 name Administrativo
exit
```

### 3.2 Puertos de acceso (ejemplo por nivel)

Solo se asignan las VLANs que existen en ese nivel; el resto no se usa en ese switch pero debe existir la VLAN por si se mueve equipo o por consistencia.

**Switch Nivel 1** (Información Pública, Auditoría):

```
interface range fa0/1 - 24
 switchport mode access
! Por ejemplo: fa0/1 para VLAN 10, fa0/2 para VLAN 20
interface fa0/1
 switchport access vlan 10
interface fa0/2
 switchport access vlan 20
! Puerto hacia Nivel 2 = trunk
interface fa0/24
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80,90,100,110
```

**Switch Nivel 2** (Informática, Recursos Humanos, Financiero):

```
interface fa0/1
 switchport mode access
 switchport access vlan 30
interface fa0/2
 switchport mode access
 switchport access vlan 40
interface fa0/3
 switchport mode access
 switchport access vlan 50
! Puerto hacia Nivel 1 y hacia Nivel 3 = trunk
interface fa0/23
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80,90,100,110
interface fa0/24
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80,90,100,110
```

**Switch Nivel 3** (Jurídico, Comunicación Social, Servicios Generales):

```
interface fa0/1
 switchport mode access
 switchport access vlan 60
interface fa0/2
 switchport mode access
 switchport access vlan 70
interface fa0/3
 switchport mode access
 switchport access vlan 80
! Puertos trunk hacia Nivel 2 y (si aplica) Nivel 4
interface fa0/23
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80,90,100,110
interface fa0/24
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80,90,100,110
```

**Switch Nivel 4** (Dirección, Subdirección):

```
interface fa0/1
 switchport mode access
 switchport access vlan 90
interface fa0/2
 switchport mode access
 switchport access vlan 100
! Puerto hacia router y/o hacia Nivel 3 = trunk
interface fa0/24
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30,40,50,60,70,80,90,100,110
```

Ajustar números de puerto según tu diseño real; lo importante es **access** a PCs y **trunk** en enlaces switch–switch y switch–router.

---

## 4. InterVLAN: Router (Router on a Stick)

El router tiene **una interfaz física** hacia uno de los switches (por ejemplo el de Nivel 4). En esa interfaz se crean **subinterfaces**, una por VLAN, con la IP del gateway de cada subred.

### 4.1 Subinterfaces y gateways

```
enable
configure terminal
interface gigabitEthernet 0/0
 no shutdown
 exit

interface gigabitEthernet 0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.20
 encapsulation dot1Q 20
 ip address 192.168.20.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.30
 encapsulation dot1Q 30
 ip address 192.168.30.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.40
 encapsulation dot1Q 40
 ip address 192.168.40.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.50
 encapsulation dot1Q 50
 ip address 192.168.50.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.60
 encapsulation dot1Q 60
 ip address 192.168.60.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.70
 encapsulation dot1Q 70
 ip address 192.168.70.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.80
 encapsulation dot1Q 80
 ip address 192.168.80.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.90
 encapsulation dot1Q 90
 ip address 192.168.90.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.100
 encapsulation dot1Q 100
 ip address 192.168.100.1 255.255.255.0
 exit
interface gigabitEthernet 0/0.110
 encapsulation dot1Q 110
 ip address 192.168.110.1 255.255.255.0
 exit
```

Con esto el **enrutamiento entre todas las VLANs** ya funciona a nivel L3. La restricción de “solo Dirección, Subdirección, Informática y Administrativo pueden acceder al resto” se hace con **ACLs**.

---

## 5. Control de acceso (ACLs)

Objetivo:

- **VLANs con permiso total (pueden acceder al resto):** 30 (Informática), 90 (Dirección), 100 (Subdirección), 110 (Administrativo).
- **Resto de VLANs:** no pueden acceder a otras VLANs (solo su propia subred y, si se desea, internet por el router).

Se hace con ACLs extendidas aplicadas a las subinterfaces **entrantes** (traffic coming FROM that VLAN). Para cada VLAN “restringida” (10, 20, 40, 50, 60, 70, 80) se permite:

- tráfico a la propia subred (misma VLAN);
- opcional: tráfico hacia el exterior (si el router tiene ruta por otra interfaz).

Y se **niega** tráfico hacia el resto de subredes internas (otras VLANs).

### 5.1 Listas de acceso (ejemplo)

Se usan las subredes de las VLANs “restringidas” como origen y las de “todas las demás” como destino, o al revés según cómo apliques la ACL. Forma típica: en la subinterfaz de cada VLAN restringida, **entrada**: permitir mismo segmento, denegar el resto de redes internas.

Definición por VLAN restringida (origen = esa VLAN):

- **VLAN 10:** permitir 192.168.10.0/24 a 192.168.10.0/24; denegar 192.168.10.0/24 a 192.168.20.0/24, 192.168.30.0/24, … (todas las demás); permitir el resto (ej. salida a internet si aplica).
- **VLAN 20, 40, 50, 60, 70, 80:** misma idea.

Ejemplo para **VLAN 10** (Información Pública): solo puede hablar dentro de 192.168.10.0/24.

```
ip access-list extended BLOQUEAR-VLAN10-A-OTRAS
 deny   ip 192.168.10.0 0.0.0.255 192.168.20.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.30.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.40.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.50.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.60.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.70.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.80.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.90.0  0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.100.0 0.0.0.255
 deny   ip 192.168.10.0 0.0.0.255 192.168.110.0 0.0.0.255
 permit ip 192.168.10.0 0.0.0.255 any
```

Aplicación:

```
interface gigabitEthernet 0/0.10
 ip access-group BLOQUEAR-VLAN10-A-OTRAS in
```

Se repite la idea para VLANs 20, 40, 50, 60, 70 y 80. Para 30, 90, 100 y 110 **no** se aplica ACL restrictiva (tienen acceso al resto).

---

## 6. Resumen

| Elemento | Acción |
|----------|--------|
| **VLANs** | 11 VLANs (10 u 11 si se incluye Administrativo), una por departamento. |
| **Switches** | 4 switches (uno por nivel), mismos VLANs en todos, trunk entre switches y hacia el router. |
| **Puertos** | Access a PCs (una VLAN por puerto); trunk en enlaces switch–switch y switch–router. |
| **InterVLAN** | Router on a stick: una subinterfaz por VLAN con su gateway (.1). |
| **Restricción** | ACLs en las subinterfaces de las VLANs 10, 20, 40, 50, 60, 70, 80 para denegar tráfico hacia el resto de VLANs; 30, 90, 100, 110 sin ACL (acceso total). |

Con esto se cumple la segmentación “a pura VLAN” y el enrutamiento InterVLAN correcto, con el control de quién puede acceder al resto de VLANs mediante ACLs en el router.
