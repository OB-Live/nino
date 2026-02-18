# Copyright (C) 2021 CGI France
#
# This file is part of N.
#
# LINO is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# LINO is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with LINO.  If not, see <http://www.gnu.org/licenses/>.

FROM ubuntu:26.04

RUN apt-get update \
    && apt-get install -y ansible-core wget tar jq

# RUN ansible-galaxy role install OB-Live.nino -c
# RUN ansible-galaxy install -r ~/.ansible/roles/OB-Live.nino/requirements.yml -c 
# RUN ansible-playbook ~/.ansible/roles/OB-Live.nino/installation.yml

RUN wget --no-check-certificate https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq && \
    chmod +x /usr/local/bin/yq

RUN wget -O- -nv --no-check-certificate https://github.com/CGI-FR/LINO/releases/download/v3.6.2/LINO_3.6.2_linux_amd64.tar.gz \
    | tar -xz -C /usr/bin/ \
    && chmod +x /usr/bin/lino

RUN wget -O- -nv --no-check-certificate https://github.com/CGI-FR/PIMO/releases/download/v1.31.3/PIMO_1.31.3_linux_amd64.tar.gz \
    | tar -xz -C /usr/bin/ \
    && chmod +x /usr/bin/pimo

# Copy example
COPY petstore /workspace/petstore
COPY nino /usr/bin/nino

EXPOSE 2442

WORKDIR /workspace

ENTRYPOINT  []

CMD [ "/usr/bin/nino", "-d", "."]