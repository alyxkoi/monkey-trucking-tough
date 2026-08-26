/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for Monkey Trucking</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://ssuciilipipwlakpwhim.supabase.co/storage/v1/object/public/email-assets/monkey-trucking-logo.png" alt="Monkey Trucking" width="160" height="auto" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>Click the button below to log in to Monkey Trucking. This link will expire shortly.</Text>
        <Button style={button} href={confirmationUrl}>Log In</Button>
        <Text style={footer}>If you didn't request this link, you can safely ignore this email.</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#6e6e6e', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: 'hsl(0, 100%, 62%)', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
