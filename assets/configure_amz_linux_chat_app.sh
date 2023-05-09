#!/bin/bash -xe
# Install OS packages
sudo yum -y groupinstall "Development Tools"
sudo yum -y install openssl-devel bzip2-devel libffi-devel
sudo yum -y install wget
wget https://www.python.org/ftp/python/3.9.10/Python-3.9.10.tgz
tar xvf Python-3.9.10.tgz
cd Python-*/
./configure --enable-optimizations
sudo make altinstall
export PATH="/usr/local/bin:$PATH"

amazon-linux-extras install -y nginx1
yum install -y nginx ruby wget
pip3 install pipenv wheel
pip3 install torch
pip3 install uvicorn fastapi transformers

# Code Deploy Agent
cd /home/ec2-user
wget https://aws-codedeploy-us-west-2.s3.us-west-2.amazonaws.com/latest/install
chmod +x ./install
./install auto



