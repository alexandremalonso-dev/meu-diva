#!/bin/bash
gcloud compute instances stop jitsi-server-prod --zone=southamerica-east1-b --quiet
echo "$(date): Jitsi parado automaticamente" >> /var/log/jitsi-autostop.log
